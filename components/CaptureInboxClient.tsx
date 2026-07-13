// components/CaptureInboxClient.tsx
// 3j Capture Inbox. capture_staging has existed since migration 058 but had
// zero rows and no UI anywhere -- nothing had ever defined what raw_payload
// should actually contain per capture_type, since nothing had used it yet.
// Real minimal shape defined here, per type:
//   inventory:  { name, category?, location_name?, current_qty?, notes? }
//   recipe:     { name, notes? } -- notes carries raw ingredients/instructions
//               text; parsing that into real recipe_ingredients rows is a
//               separate, bigger job, not built here. Approving creates a
//               real recipe with name + notes, left for manual completion.
//   meal_plan:  { plan_date, course, custom_name? }
// Approving an inventory capture relies on the existing
// trg_log_inventory_item_change trigger to create the inventory_item_history
// row automatically -- not written here directly.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import Link from 'next/link';
import { COURSES } from '@/lib/course-constants';

type CaptureType = 'recipe' | 'inventory' | 'meal_plan';

type Capture = {
  id: string;
  capture_type: CaptureType;
  raw_payload: Record<string, any>;
  submitted_by: string | null;
  submitted_by_name: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<CaptureType, string> = {
  recipe: 'Recipe',
  inventory: 'Inventory',
  meal_plan: 'Meal Plan',
};

export default function CaptureInboxClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<CaptureType | 'all'>('all');
  const [editedPayloads, setEditedPayloads] = useState<Record<string, Record<string, any>>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [borrowedOutCount, setBorrowedOutCount] = useState<number | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [captureRes, locRes, recipeRes, borrowedRes] = await Promise.all([
      supabase
        .from('capture_staging')
        .select('id, capture_type, raw_payload, submitted_by, created_at, profiles(full_name)')
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .order('created_at'),
      supabase.from('locations').select('id, name').eq('property_id', propertyId),
      supabase.from('recipes').select('id, name').eq('property_id', propertyId),
      supabase.from('borrowed_items').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('returned', false),
    ]);

    setCaptures(
      (captureRes.data ?? []).map((c: any) => ({
        id: c.id,
        capture_type: c.capture_type,
        raw_payload: c.raw_payload ?? {},
        submitted_by: c.submitted_by,
        submitted_by_name: c.profiles?.full_name ?? null,
        created_at: c.created_at,
      }))
    );
    setLocations(locRes.data ?? []);
    setRecipes(recipeRes.data ?? []);
    setBorrowedOutCount(borrowedRes.count ?? 0);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function fieldsFor(capture: Capture): Record<string, any> {
    return editedPayloads[capture.id] ?? capture.raw_payload;
  }

  function setField(captureId: string, raw: Record<string, any>, key: string, value: any) {
    setEditedPayloads((prev) => ({
      ...prev,
      [captureId]: { ...(prev[captureId] ?? raw), [key]: value },
    }));
  }

  async function reviewCapture(capture: Capture, decision: 'approved' | 'rejected') {
    setProcessingIds((prev) => new Set(prev).add(capture.id));
    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      if (decision === 'approved') {
        const payload = fieldsFor(capture);
        const ok = await writeApproved(capture.capture_type, payload);
        if (!ok) {
          showToast('Could not write the approved capture — check required fields.', { variant: 'error' });
          setProcessingIds((prev) => {
            const next = new Set(prev);
            next.delete(capture.id);
            return next;
          });
          return;
        }
      }

      const result = await resilientUpdate(
        supabase,
        'capture_staging',
        { id: capture.id },
        { status: decision, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }
      );
      if (!result.ok) {
        showToast('Failed to update capture status.', { variant: 'error' });
        return;
      }
      showToast(decision === 'approved' ? 'Approved and added.' : 'Rejected.', { variant: 'success' });
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(capture.id);
        return next;
      });
    }
  }

  async function writeApproved(type: CaptureType, payload: Record<string, any>): Promise<boolean> {
    if (type === 'inventory') {
      if (!payload.name?.trim()) return false;
      const location = locations.find(
        (l) => l.name.toLowerCase() === String(payload.location_name ?? '').trim().toLowerCase()
      );
      const result = await resilientInsert(supabase, 'inventory_items', {
        property_id: propertyId,
        name: payload.name.trim(),
        category: payload.category?.trim() || null,
        location_id: location?.id ?? null,
        current_qty: Number(payload.current_qty) || 0,
        min_qty: 0,
        unit: 'pcs',
        notes: payload.notes?.trim() || null,
      });
      return result.ok;
    }
    if (type === 'recipe') {
      if (!payload.name?.trim()) return false;
      const result = await resilientInsert(supabase, 'recipes', {
        property_id: propertyId,
        name: payload.name.trim(),
        notes: payload.notes?.trim() || null,
        tags: ['NEW', 'captured'],
      });
      return result.ok;
    }
    if (type === 'meal_plan') {
      if (!payload.plan_date || !payload.course) return false;
      const matchedRecipe = recipes.find(
        (r) => r.name.toLowerCase() === String(payload.recipe_name ?? '').trim().toLowerCase()
      );
      const result = await resilientInsert(supabase, 'meal_plan_entries', {
        property_id: propertyId,
        plan_date: payload.plan_date,
        course: payload.course,
        meal_slot: 'dinner',
        recipe_id: matchedRecipe?.id ?? null,
        custom_name: matchedRecipe ? null : payload.custom_name?.trim() || payload.recipe_name?.trim() || null,
        sequence: 1,
      });
      return result.ok;
    }
    return false;
  }

  const filtered = activeType === 'all' ? captures : captures.filter((c) => c.capture_type === activeType);
  const countsByType = (['recipe', 'inventory', 'meal_plan'] as CaptureType[]).reduce(
    (acc, t) => ({ ...acc, [t]: captures.filter((c) => c.capture_type === t).length }),
    {} as Record<CaptureType, number>
  );

  if (!canManage(role)) {
    return <p className="max-w-md mx-auto p-4 text-sm text-charcoal/50">Only an owner or manager can review captures.</p>;
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Capture Inbox</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Submitted recipe, inventory, and meal plan captures, reviewed here before they go live.
      </p>

      {borrowedOutCount !== null && borrowedOutCount > 0 && (
        <Link
          href={`/properties/${propertyId}/tools`}
          className="block bg-gold-light/15 border border-gold-light rounded-2xl p-3 mb-4 text-sm text-charcoal hover:bg-gold-light/25 transition-colors"
        >
          🔄 {borrowedOutCount} borrowed/lent item{borrowedOutCount === 1 ? '' : 's'} still out — see Borrowed & Lent
        </Link>
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setActiveType('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeType === 'all' ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70'
          }`}
        >
          All ({captures.length})
        </button>
        {(['recipe', 'inventory', 'meal_plan'] as CaptureType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeType === t ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70'
            }`}
          >
            {TYPE_LABEL[t]} ({countsByType[t]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-charcoal/40 text-center py-12">
          Nothing waiting for review right now.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((capture) => {
            const fields = fieldsFor(capture);
            const busy = processingIds.has(capture.id);
            return (
              <div key={capture.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gold-dark">
                    {TYPE_LABEL[capture.capture_type]}
                  </span>
                  <span className="text-xs text-charcoal/40">
                    {capture.submitted_by_name ?? 'Someone'} ·{' '}
                    {new Date(capture.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {capture.capture_type === 'inventory' && (
                  <div className="space-y-2">
                    <input
                      value={fields.name ?? ''}
                      onChange={(e) => setField(capture.id, capture.raw_payload, 'name', e.target.value)}
                      placeholder="Item name"
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={fields.category ?? ''}
                        onChange={(e) => setField(capture.id, capture.raw_payload, 'category', e.target.value)}
                        placeholder="Category"
                        className="border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                      />
                      <input
                        value={fields.location_name ?? ''}
                        onChange={(e) => setField(capture.id, capture.raw_payload, 'location_name', e.target.value)}
                        placeholder="Location (matched by name)"
                        className="border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      value={fields.notes ?? ''}
                      onChange={(e) => setField(capture.id, capture.raw_payload, 'notes', e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {capture.capture_type === 'recipe' && (
                  <div className="space-y-2">
                    <input
                      value={fields.name ?? ''}
                      onChange={(e) => setField(capture.id, capture.raw_payload, 'name', e.target.value)}
                      placeholder="Recipe name"
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                    <textarea
                      value={fields.notes ?? ''}
                      onChange={(e) => setField(capture.id, capture.raw_payload, 'notes', e.target.value)}
                      placeholder="Raw ingredients / instructions text — added as-is, needs manual completion after"
                      rows={3}
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                    <p className="text-[11px] text-charcoal/40">
                      Approving creates a real recipe with this name and text — it won't have structured ingredients
                      yet, that still needs finishing on the recipe's own edit page.
                    </p>
                  </div>
                )}

                {capture.capture_type === 'meal_plan' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={fields.plan_date ?? ''}
                        onChange={(e) => setField(capture.id, capture.raw_payload, 'plan_date', e.target.value)}
                        className="border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                      />
                      <select
                        value={fields.course ?? ''}
                        onChange={(e) => setField(capture.id, capture.raw_payload, 'course', e.target.value)}
                        className="border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Course…</option>
                        {COURSES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={fields.recipe_name ?? fields.custom_name ?? ''}
                      onChange={(e) => setField(capture.id, capture.raw_payload, 'recipe_name', e.target.value)}
                      placeholder="Recipe name (matched if it exists, otherwise added as a custom entry)"
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => reviewCapture(capture, 'rejected')}
                    disabled={busy}
                    className="flex-1 py-2 rounded-full border border-gold-light/60 text-charcoal text-sm disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => reviewCapture(capture, 'approved')}
                    disabled={busy}
                    className="flex-1 py-2 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
                  >
                    {busy ? 'Saving…' : 'Approve'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
