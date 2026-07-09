// components/GuestScalerClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { formatScaledNumber } from '@/lib/scale-quantity';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Event = {
  id: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  notes: string | null;
};

type RecipeOption = { id: string; name: string; servings: number | null };
type Ingredient = { id: string; name: string; quantity: number | null; unit: string | null };

export default function GuestScalerClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editGuestCount, setEditGuestCount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [search, setSearch] = useState('');
  const [pickedRecipes, setPickedRecipes] = useState<RecipeOption[]>([]);
  const [ingredientsByRecipe, setIngredientsByRecipe] = useState<Record<string, Ingredient[]>>({});

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('household_events')
      .select('id, event_type, event_date, guest_count, notes')
      .eq('property_id', propertyId)
      .order('event_date', { ascending: false });
    setEvents(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, name, servings')
      .eq('property_id', propertyId)
      .order('name')
      .then(({ data }) => setRecipeOptions(data ?? []));
  }, [propertyId, supabase]);

  async function addEvent() {
    if (!eventType.trim() || !guestCount) return;
    setSaving(true);
    const result = await resilientInsert(supabase, 'household_events', {
      property_id: propertyId,
      event_type: eventType.trim(),
      event_date: eventDate || null,
      guest_count: parseInt(guestCount, 10),
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Event added.', { variant: 'success' });
    setEventType('');
    setEventDate('');
    setGuestCount('');
    setNotes('');
    loadEvents();
  }

  function startEdit(event: Event) {
    setEditType(event.event_type ?? '');
    setEditDate(event.event_date ?? '');
    setEditGuestCount(event.guest_count != null ? String(event.guest_count) : '');
    setEditNotes(event.notes ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!activeEventId || !editType.trim() || !editGuestCount) return;
    setSavingEdit(true);
    const result = await resilientUpdate(
      supabase,
      'household_events',
      { id: activeEventId },
      {
        event_type: editType.trim(),
        event_date: editDate || null,
        guest_count: parseInt(editGuestCount, 10),
        notes: editNotes.trim() || null,
      }
    );
    setSavingEdit(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Event updated.', { variant: 'success' });
    setEditing(false);
    loadEvents();
  }

  async function removeEvent(id: string) {
    const result = await resilientDelete(supabase, 'household_events', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (activeEventId === id) {
      setActiveEventId(null);
      setEditing(false);
    }
  }

  async function addRecipeToScaler(recipe: RecipeOption) {
    if (pickedRecipes.some((r) => r.id === recipe.id)) return;
    setPickedRecipes((prev) => [...prev, recipe]);
    setSearch('');

    if (!ingredientsByRecipe[recipe.id]) {
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('id, name, quantity, unit')
        .eq('recipe_id', recipe.id)
        .eq('is_food', true);
      setIngredientsByRecipe((prev) => ({ ...prev, [recipe.id]: data ?? [] }));
    }
  }

  function removeRecipeFromScaler(recipeId: string) {
    setPickedRecipes((prev) => prev.filter((r) => r.id !== recipeId));
  }

  if (loading) return <SkeletonList />;

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;
  const filteredRecipes = recipeOptions.filter(
    (r) => search.trim() && r.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto p-4 print:max-w-full">
      <h1 className="text-2xl font-display text-charcoal mb-1 print:hidden">Simcha Guest Scaler</h1>
      <p className="text-sm text-charcoal/50 mb-4 print:hidden">Scale any recipe to how many people are actually coming.</p>

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2 print:hidden">
          <h2 className="font-display text-lg text-charcoal mb-1">New event</h2>
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="Event (e.g. Bar Mitzvah Kiddush)"
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="flex-1 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Guests"
              className="w-28 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={addEvent}
            disabled={saving || !eventType.trim() || !guestCount}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add event'}
          </button>
        </div>
      )}

      {events.length === 0 && <p className="text-sm text-charcoal/40 text-center py-4 print:hidden">No events yet.</p>}

      <ul className="space-y-2 mb-6 print:hidden">
        {events.map((ev) => (
          <li key={ev.id}>
            <button
              onClick={() => {
                setActiveEventId(activeEventId === ev.id ? null : ev.id);
                setEditing(false);
              }}
              className={`w-full text-left rounded-xl p-3 shadow-sm shadow-charcoal/5 transition-colors ${
                activeEventId === ev.id ? 'bg-gold-dark text-white' : 'bg-white text-charcoal hover:bg-gold-light/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{ev.event_type}</span>
                <span className="text-xs opacity-80">{ev.guest_count} guests</span>
              </div>
              {ev.event_date && <span className="text-xs opacity-70">{ev.event_date}</span>}
            </button>
          </li>
        ))}
      </ul>

      {activeEvent && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 print:shadow-none print:border-0">
          <div className="hidden print:block mb-4">
            <h1 className="font-display text-2xl text-charcoal">Guest Prep Pack</h1>
            <p className="text-sm text-charcoal/60">
              {activeEvent.event_type} — {activeEvent.guest_count} guests
              {activeEvent.event_date ? ` — ${activeEvent.event_date}` : ''}
            </p>
          </div>
          <div className="flex items-center justify-between mb-3 print:hidden">
            <h2 className="font-display text-lg text-charcoal">
              Scaling for {activeEvent.guest_count} at {activeEvent.event_type}
            </h2>
            <div className="flex items-center gap-3">
              {pickedRecipes.length > 0 && (
                <button onClick={() => window.print()} className="text-xs font-medium text-gold-dark hover:text-charcoal">
                  🖨️ Print Prep Pack
                </button>
              )}
              {canManage(role) && !editing && (
                <button
                  onClick={() => startEdit(activeEvent)}
                  className="text-xs font-medium text-gold-dark hover:text-charcoal"
                >
                  Edit
                </button>
              )}
              {canManage(role) && (
                <button
                  onClick={() => removeEvent(activeEvent.id)}
                  className="text-xs text-charcoal/30 hover:text-rust"
                >
                  Delete event
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <div className="border border-gold-light/40 rounded-xl p-3 mb-4 space-y-2 print:hidden">
              <input
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                placeholder="Event"
                className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={editGuestCount}
                  onChange={(e) => setEditGuestCount(e.target.value)}
                  placeholder="Guests"
                  className="w-28 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || !editType.trim() || !editGuestCount}
                  className="flex-1 py-2 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            activeEvent.notes && (
              <p className="text-sm text-charcoal/60 mb-4 print:mb-2">{activeEvent.notes}</p>
            )
          )}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes to add…"
            className="w-full border border-gold-light/60 rounded-full px-4 py-2 text-sm mb-2 print:hidden"
          />
          {filteredRecipes.length > 0 && (
            <div className="border border-gold-light/40 rounded-xl divide-y divide-gold-light/20 mb-4 max-h-40 overflow-y-auto">
              {filteredRecipes.slice(0, 20).map((r) => (
                <button
                  key={r.id}
                  onClick={() => addRecipeToScaler(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {pickedRecipes.length === 0 && (
            <p className="text-sm text-charcoal/40 py-4 text-center print:hidden">Add recipes above to scale them.</p>
          )}

          <div className="space-y-4">
            {pickedRecipes.map((recipe) => {
              const baseServings = recipe.servings ?? 4;
              const scaleFactor = (activeEvent.guest_count ?? baseServings) / baseServings;
              const ingredients = ingredientsByRecipe[recipe.id] ?? [];
              return (
                <div key={recipe.id} className="border border-gold-light/30 rounded-xl p-3 print:border-0 print:px-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm text-charcoal">{recipe.name}</h3>
                    <button
                      onClick={() => removeRecipeFromScaler(recipe.id)}
                      className="text-xs text-charcoal/30 hover:text-rust print:hidden"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gold-dark mb-2">
                    Scaled from {baseServings} to {activeEvent.guest_count} servings
                  </p>
                  <ul className="space-y-1">
                    {ingredients.map((i) => (
                      <li key={i.id} className="text-sm text-charcoal">
                        {i.quantity != null
                          ? `${formatScaledNumber(i.quantity * scaleFactor)} ${i.unit ?? ''} ${i.name}`
                          : `${i.unit ?? ''} ${i.name}`}
                      </li>
                    ))}
                    {ingredients.length === 0 && (
                      <li className="text-sm text-charcoal/40">No ingredients recorded.</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
