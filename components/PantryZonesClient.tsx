// components/PantryZonesClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { flattenLocationTree, locationPath } from '@/lib/location-tree';
import FieldLabel from '@/components/FieldLabel';

type Location = { id: string; name: string; parent_location_id: string | null };
type Zone = {
  id: string;
  zone_name: string;
  location_id: string | null;
  description: string | null;
};

// A text-based list grouped by location, deliberately — not a literal
// floor-plan map. pantry_zones has no coordinate/image fields, and this
// covers the actual need ("where does X live") without inventing a
// visual-layout feature nobody asked for.
export default function PantryZonesClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [zoneName, setZoneName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [locRes, zoneRes] = await Promise.all([
      supabase
        .from('locations')
        .select('id, name, parent_location_id')
        .eq('property_id', propertyId)
        .order('sort_order'),
      supabase
        .from('pantry_zones')
        .select('id, zone_name, location_id, description')
        .eq('property_id', propertyId)
        .order('zone_name'),
    ]);
    setLocations(locRes.data ?? []);
    setZones(zoneRes.data ?? []);
    if (!locationId && locRes.data?.length) setLocationId(locRes.data[0].id);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addZone() {
    if (!zoneName.trim() || !locationId) return;
    setSaving(true);
    const result = await resilientInsert(supabase, 'pantry_zones', {
      property_id: propertyId,
      zone_name: zoneName.trim(),
      location_id: locationId,
      description: description.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added.', { variant: 'success' });
    setZoneName('');
    setDescription('');
    load();
  }

  async function removeZone(id: string) {
    const result = await resilientDelete(supabase, 'pantry_zones', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  if (loading) return <SkeletonList />;

  const grouped = zones.reduce<Record<string, Zone[]>>((acc, z) => {
    const key = locationPath(locations, z.location_id);
    (acc[key] ??= []).push(z);
    return acc;
  }, {});

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Pantry Zone Map</h1>
      <p className="text-sm text-charcoal/50 mb-4">Where things live within each storage location.</p>

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Add a zone</h2>
          <div>
            <FieldLabel>Zone name</FieldLabel>
            <input
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Top shelf, left side"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white"
            >
              {locations.length === 0 && <option value="">No locations yet</option>}
              {flattenLocationTree(locations).map((l) => (
                <option key={l.id} value={l.id}>
                  {'  '.repeat(l.depth)}
                  {l.depth > 0 ? '↳ ' : ''}
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Description (optional)</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's kept here (optional)"
              rows={2}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addZone}
            disabled={saving || !zoneName.trim() || !locationId}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add zone'}
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          {canManage(role)
            ? 'No zones mapped yet — use the form above to add one, e.g. "Top shelf, left side."'
            : 'No zones mapped yet. Ask a manager to map one.'}
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([loc, locZones]) => (
          <div key={loc}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">{loc}</h3>
            <ul className="space-y-2">
              {locZones.map((z) => (
                <li key={z.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-charcoal">{z.zone_name}</p>
                    {canManage(role) && (
                      <button
                        onClick={() => removeZone(z.id)}
                        className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                        aria-label="Delete zone"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {z.description && <p className="text-sm text-charcoal/60 mt-1">{z.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
