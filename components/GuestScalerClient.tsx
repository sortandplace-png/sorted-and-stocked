// components/GuestScalerClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { formatScaledNumber } from '@/lib/scale-quantity';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';

type Event = {
  id: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  notes: string | null;
};

type RecipeOption = { id: string; name: string; servings: number | null };
type Ingredient = { id: string; name: string; quantity: number | null; unit: string | null; category: string | null };

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

  // SS-037: start scaling from what's already planned for a real date,
  // instead of only manual recipe-by-recipe search. Defaults to the
  // active event's own date (the obvious first thing to check: "is there
  // already a meal plan for this event?"), but stays freely editable --
  // a Sunday simcha might want to scale up Friday's planned menu instead
  // of its own (empty) date.
  const [mealPlanDate, setMealPlanDate] = useState('');
  const [loadingMealPlan, setLoadingMealPlan] = useState(false);
  const [pushingToShoppingList, setPushingToShoppingList] = useState(false);

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
      .select('id, name, servings, recipe_property_links!inner(property_id)')
      .eq('recipe_property_links.property_id', propertyId)
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

  const loadIngredientsFor = useCallback(
    async (recipeId: string) => {
      if (ingredientsByRecipe[recipeId]) return;
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('id, name, quantity, unit, category')
        .eq('recipe_id', recipeId)
        .eq('is_food', true);
      setIngredientsByRecipe((prev) => ({ ...prev, [recipeId]: data ?? [] }));
    },
    [ingredientsByRecipe, supabase]
  );

  async function addRecipeToScaler(recipe: RecipeOption) {
    if (pickedRecipes.some((r) => r.id === recipe.id)) return;
    setPickedRecipes((prev) => [...prev, recipe]);
    setSearch('');
    await loadIngredientsFor(recipe.id);
  }

  function removeRecipeFromScaler(recipeId: string) {
    setPickedRecipes((prev) => prev.filter((r) => r.id !== recipeId));
  }

  // SS-037: pull every recipe already planned for a real date (across all
  // meal slots that day -- e.g. Dinner's soup, main, and side) straight
  // into the scaler, instead of re-finding each one by hand. Entries with
  // no linked recipe (custom_name only) have nothing to scale, skipped;
  // the same recipe appearing in more than one slot that day is only
  // added once (addRecipeToScaler already no-ops on a repeat id).
  async function loadFromMealPlanDate(date: string) {
    if (!date) return;
    setLoadingMealPlan(true);
    const { data } = await supabase
      .from('meal_plan_entries')
      .select('recipe_id, recipes(id, name, servings)')
      .eq('property_id', propertyId)
      .eq('plan_date', date)
      .not('recipe_id', 'is', null);
    setLoadingMealPlan(false);

    // Dedupe by recipe id -- the same dish can legitimately appear in more
    // than one meal_plan_entries row for the same date (e.g. a side served
    // at both lunch and dinner), and addRecipeToScaler's own guard against
    // re-adding a picked recipe can't be relied on across this loop: each
    // iteration awaits a real fetch, but they all still close over the
    // same pickedRecipes snapshot from when this function started, so a
    // repeat within this batch wouldn't actually be caught without this.
    const byId = new Map<string, RecipeOption>();
    for (const row of data ?? []) {
      const r = row.recipes as unknown as RecipeOption | null;
      if (r && !byId.has(r.id)) byId.set(r.id, r);
    }
    const planned = [...byId.values()];
    if (planned.length === 0) {
      showToast('Nothing planned on that date.', { variant: 'default' });
      return;
    }
    for (const recipe of planned) {
      await addRecipeToScaler(recipe);
    }
    showToast(`Loaded ${planned.length} recipe${planned.length === 1 ? '' : 's'} from ${date}.`, { variant: 'success' });
  }

  // SS-187: the scaled amounts on screen, not the recipe's original
  // amounts -- reuses the same active-list find-or-create/merge/dedupe
  // logic the meal-plan week generator and recipe detail page's own "add
  // to list" already go through (addIngredientsToShoppingList), so this
  // doesn't become a second, slightly different way of writing to the
  // shopping list.
  async function pushToShoppingList() {
    if (!activeEvent || pickedRecipes.length === 0) return;
    setPushingToShoppingList(true);
    const toAdd = pickedRecipes.flatMap((recipe) => {
      const baseServings = recipe.servings ?? 4;
      const scaleFactor = (activeEvent.guest_count ?? baseServings) / baseServings;
      const ingredients = ingredientsByRecipe[recipe.id] ?? [];
      return ingredients.map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity != null ? i.quantity * scaleFactor : null,
        unit: i.unit,
        recipe_id: recipe.id,
      }));
    });
    const result = await addIngredientsToShoppingList(supabase, propertyId, toAdd);
    setPushingToShoppingList(false);
    if (!result.ok) {
      showToast(result.error, { variant: 'error' });
      return;
    }
    showToast(`Added ${result.count} ingredient${result.count === 1 ? '' : 's'} to the shopping list.`, { variant: 'success' });
  }

  if (loading) return <SkeletonList />;

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;
  const filteredRecipes = recipeOptions.filter(
    (r) => search.trim() && r.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto p-4 print:max-w-full">
      <h1 className="text-2xl font-display text-denim mb-1 print:hidden">Simcha Guest Scaler</h1>
      <p className="text-sm text-dusk mb-4 print:hidden">Scale any recipe to how many people are actually coming.</p>

      {canManage(role) && (
        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-6 space-y-2 print:hidden">
          <h2 className="font-display text-lg text-denim mb-1">New event</h2>
          <div>
            <FieldLabel>Event</FieldLabel>
            <input
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. Bar Mitzvah Kiddush"
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <FieldLabel>Date</FieldLabel>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="w-28">
              <FieldLabel>Guests</FieldLabel>
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="Guests"
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addEvent}
            disabled={saving || !eventType.trim() || !guestCount}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add event'}
          </button>
        </div>
      )}

      {events.length === 0 && (
        <p className="text-sm text-dusk text-center py-4 print:hidden">
          No events yet — use the form above to add your first one (e.g. "Shabbos Dinner, 12 guests").
        </p>
      )}

      <ul className="space-y-2 mb-6 print:hidden">
        {events.map((ev) => (
          <li key={ev.id}>
            <button
              onClick={() => {
                const nowActive = activeEventId !== ev.id;
                setActiveEventId(nowActive ? ev.id : null);
                setEditing(false);
                setMealPlanDate(nowActive ? ev.event_date ?? '' : '');
              }}
              className={`w-full text-left rounded-xl p-3 border border-cardBorder shadow-card transition-colors ${
                activeEventId === ev.id ? 'bg-denim text-white' : 'bg-card text-denim hover:bg-mist'
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
        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 print:shadow-none print:border-0">
          <div className="hidden print:block mb-4">
            <h1 className="font-display text-2xl text-denim">Guest Prep Pack</h1>
            <p className="text-sm text-dusk">
              {activeEvent.event_type} — {activeEvent.guest_count} guests
              {activeEvent.event_date ? ` — ${activeEvent.event_date}` : ''}
            </p>
          </div>
          <div className="flex items-center justify-between mb-3 print:hidden">
            <h2 className="font-display text-lg text-denim">
              Scaling for {activeEvent.guest_count} at {activeEvent.event_type}
            </h2>
            <div className="flex items-center gap-3">
              {pickedRecipes.length > 0 && (
                <button onClick={() => window.print()} className="text-xs font-medium text-brass hover:text-denim">
                  Print Prep Pack
                </button>
              )}
              {canManage(role) && !editing && (
                <button
                  onClick={() => startEdit(activeEvent)}
                  className="text-xs font-medium text-brass hover:text-denim"
                >
                  Edit
                </button>
              )}
              {canManage(role) && (
                <button
                  onClick={() => removeEvent(activeEvent.id)}
                  className="text-xs text-dusk hover:text-rust"
                >
                  Delete event
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <div className="border border-cardBorder rounded-xl p-3 mb-4 space-y-2 print:hidden">
              <input
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                placeholder="Event"
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 border border-cardBorder rounded-xl px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={editGuestCount}
                  onChange={(e) => setEditGuestCount(e.target.value)}
                  placeholder="Guests"
                  className="w-28 border border-cardBorder rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 rounded-full bg-card border border-brass/30 text-denim text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || !editType.trim() || !editGuestCount}
                  className="flex-1 py-2 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            activeEvent.notes && (
              <p className="text-sm text-dusk mb-4 print:mb-2">{activeEvent.notes}</p>
            )
          )}

          {/* SS-037: load straight from a real meal plan date instead of
              only manual per-recipe search below. */}
          <div className="flex items-end gap-2 mb-3 print:hidden">
            <div className="flex-1">
              <FieldLabel>Load from meal plan date</FieldLabel>
              <input
                type="date"
                value={mealPlanDate}
                onChange={(e) => setMealPlanDate(e.target.value)}
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => loadFromMealPlanDate(mealPlanDate)}
              disabled={!mealPlanDate || loadingMealPlan}
              className="shrink-0 py-2 px-3.5 rounded-xl bg-mist text-denim text-sm font-medium disabled:opacity-40"
            >
              {loadingMealPlan ? 'Loading…' : 'Load'}
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Or search recipes to add…"
            className="w-full border border-cardBorder rounded-full px-4 py-2 text-sm mb-2 print:hidden"
          />
          {filteredRecipes.length > 0 && (
            <div className="border border-cardBorder rounded-xl divide-y divide-cardBorder mb-4 max-h-40 overflow-y-auto">
              {filteredRecipes.slice(0, 20).map((r) => (
                <button
                  key={r.id}
                  onClick={() => addRecipeToScaler(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-mist"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {pickedRecipes.length === 0 && (
            <p className="text-sm text-dusk py-4 text-center print:hidden">Add recipes above to scale them.</p>
          )}

          {pickedRecipes.length > 0 && (
            <button
              onClick={pushToShoppingList}
              disabled={pushingToShoppingList}
              className="w-full mb-4 py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40 print:hidden"
            >
              {pushingToShoppingList ? 'Adding…' : 'Push Scaled Quantities to Shopping List'}
            </button>
          )}

          <div className="space-y-4">
            {pickedRecipes.map((recipe) => {
              const baseServings = recipe.servings ?? 4;
              const scaleFactor = (activeEvent.guest_count ?? baseServings) / baseServings;
              const ingredients = ingredientsByRecipe[recipe.id] ?? [];
              return (
                <div key={recipe.id} className="border border-cardBorder rounded-xl p-3 print:border-0 print:px-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm text-denim">{recipe.name}</h3>
                    <button
                      onClick={() => removeRecipeFromScaler(recipe.id)}
                      className="text-xs text-dusk hover:text-rust print:hidden"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-brass mb-2">
                    Scaled from {baseServings} to {activeEvent.guest_count} servings
                  </p>
                  <ul className="space-y-1">
                    {ingredients.map((i) => (
                      <li key={i.id} className="text-sm text-denim">
                        {i.quantity != null
                          ? `${formatScaledNumber(i.quantity * scaleFactor)} ${i.unit ?? ''} ${i.name}`
                          : `${i.unit ?? ''} ${i.name}`}
                      </li>
                    ))}
                    {ingredients.length === 0 && (
                      <li className="text-sm text-dusk">No ingredients recorded.</li>
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
