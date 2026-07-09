// components/GuestTasteMemoryClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type PersonType = 'family' | 'guest';
type PreferenceType = 'like' | 'dislike' | 'allergy' | 'sensitivity';
type LinkType = 'none' | 'recipe' | 'inventory_item';

type Person = {
  id: string;
  name: string;
  person_type: PersonType;
  active: boolean;
  notes: string | null;
};

type Preference = {
  id: string;
  person_id: string;
  preference_type: PreferenceType;
  subject: string;
  notes: string | null;
  recipe: { name: string } | null;
  inventory_item: { name: string } | null;
};

type LookupRow = { id: string; name: string };

const PREFERENCE_LABELS: Record<PreferenceType, string> = {
  like: 'Like',
  dislike: 'Dislike',
  allergy: 'Allergy',
  sensitivity: 'Sensitivity',
};

const PREFERENCE_STYLES: Record<PreferenceType, string> = {
  like: 'text-sage',
  dislike: 'text-charcoal/60',
  allergy: 'text-rust font-semibold',
  sensitivity: 'text-rust',
};

export default function GuestTasteMemoryClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [people, setPeople] = useState<Person[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('family');
  const [active, setActive] = useState(true);
  const [personNotes, setPersonNotes] = useState('');
  const [savingPerson, setSavingPerson] = useState(false);

  const [openPrefFor, setOpenPrefFor] = useState<string | null>(null);
  const [prefType, setPrefType] = useState<PreferenceType>('like');
  const [subject, setSubject] = useState('');
  const [prefNotes, setPrefNotes] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('none');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkedItem, setLinkedItem] = useState<LookupRow | null>(null);
  const [recipes, setRecipes] = useState<LookupRow[] | null>(null);
  const [inventoryItems, setInventoryItems] = useState<LookupRow[] | null>(null);
  const [savingPref, setSavingPref] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: peopleData }, { data: prefData }] = await Promise.all([
      supabase
        .from('household_people')
        .select('id, name, person_type, active, notes')
        .eq('property_id', propertyId)
        .order('active', { ascending: false })
        .order('name'),
      supabase
        .from('person_food_preferences')
        .select('id, person_id, preference_type, subject, notes, recipe:recipes(name), inventory_item:inventory_items(name)')
        .eq('property_id', propertyId),
    ]);
    setPeople(peopleData ?? []);
    setPreferences((prefData as unknown as Preference[]) ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addPerson() {
    if (!name.trim()) return;
    setSavingPerson(true);
    const result = await resilientInsert(supabase, 'household_people', {
      property_id: propertyId,
      name: name.trim(),
      person_type: personType,
      active,
      notes: personNotes.trim() || null,
    });
    setSavingPerson(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Person added.', { variant: 'success' });
    setName('');
    setPersonType('family');
    setActive(true);
    setPersonNotes('');
    load();
  }

  async function removePerson(id: string) {
    const result = await resilientDelete(supabase, 'household_people', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setPreferences((prev) => prev.filter((p) => p.person_id !== id));
  }

  function openPreferenceForm(personId: string) {
    setOpenPrefFor(personId);
    setPrefType('like');
    setSubject('');
    setPrefNotes('');
    setLinkType('none');
    setLinkSearch('');
    setLinkedItem(null);
  }

  async function ensureLookupsLoaded() {
    if (recipes === null) {
      const { data } = await supabase.from('recipes').select('id, name').eq('property_id', propertyId).order('name');
      setRecipes(data ?? []);
    }
    if (inventoryItems === null) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .order('name');
      setInventoryItems(data ?? []);
    }
  }

  async function setLink(type: LinkType) {
    setLinkType(type);
    setLinkedItem(null);
    setLinkSearch('');
    if (type !== 'none') await ensureLookupsLoaded();
  }

  async function addPreference() {
    if (!openPrefFor || !subject.trim()) return;
    setSavingPref(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await resilientInsert(supabase, 'person_food_preferences', {
      property_id: propertyId,
      person_id: openPrefFor,
      preference_type: prefType,
      subject: subject.trim(),
      recipe_id: linkType === 'recipe' ? linkedItem?.id ?? null : null,
      inventory_item_id: linkType === 'inventory_item' ? linkedItem?.id ?? null : null,
      notes: prefNotes.trim() || null,
      created_by: user?.id ?? null,
    });
    setSavingPref(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Preference added.', { variant: 'success' });
    setOpenPrefFor(null);
    load();
  }

  async function removePreference(id: string) {
    const result = await resilientDelete(supabase, 'person_food_preferences', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setPreferences((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <SkeletonList />;

  const lookupList = linkType === 'recipe' ? recipes : linkType === 'inventory_item' ? inventoryItems : null;
  const filteredLookup =
    lookupList?.filter((l) => l.name.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 20) ?? [];

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Guest &amp; Family Taste Memory</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Likes, dislikes, allergies, and sensitivities — kept with the person, not just the meal.
      </p>

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Add a person</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex bg-cream rounded-full border border-gold-light/60 p-0.5 text-sm">
            <button
              onClick={() => setPersonType('family')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                personType === 'family' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
              }`}
            >
              Family
            </button>
            <button
              onClick={() => setPersonType('guest')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                personType === 'guest' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
              }`}
            >
              Guest
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal/70 px-1">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            Active
          </label>
          <textarea
            value={personNotes}
            onChange={(e) => setPersonNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={addPerson}
            disabled={savingPerson || !name.trim()}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {savingPerson ? 'Saving…' : 'Add person'}
          </button>
        </div>
      )}

      {people.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          {canManage(role)
            ? 'No one added yet — use the form above to add a family member or guest.'
            : 'No one added yet. Ask a manager to add someone.'}
        </p>
      )}

      <ul className="space-y-3">
        {people.map((person) => {
          const personPrefs = preferences.filter((p) => p.person_id === person.id);
          return (
            <li
              key={person.id}
              className={`bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-3 ${!person.active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm text-charcoal">
                    {person.name}{' '}
                    <span className="text-xs font-normal text-charcoal/40">
                      · {person.person_type === 'family' ? 'Family' : 'Guest'}
                      {!person.active && ' · inactive'}
                    </span>
                  </p>
                  {person.notes && <p className="text-xs text-charcoal/50 mt-0.5">{person.notes}</p>}
                </div>
                {canManage(role) && (
                  <button
                    onClick={() => removePerson(person.id)}
                    className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                    aria-label={`Delete ${person.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>

              {personPrefs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {personPrefs.map((pref) => (
                    <li key={pref.id} className="flex items-start justify-between gap-2 text-xs">
                      <span>
                        <span className={PREFERENCE_STYLES[pref.preference_type]}>
                          {PREFERENCE_LABELS[pref.preference_type]}
                        </span>
                        <span className="text-charcoal"> · {pref.subject}</span>
                        {(pref.recipe?.name || pref.inventory_item?.name) && (
                          <span className="text-charcoal/40"> ({pref.recipe?.name ?? pref.inventory_item?.name})</span>
                        )}
                        {pref.notes && <span className="text-charcoal/40"> — {pref.notes}</span>}
                      </span>
                      {canManage(role) && (
                        <button
                          onClick={() => removePreference(pref.id)}
                          className="text-charcoal/30 hover:text-rust shrink-0"
                          aria-label="Delete preference"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canManage(role) &&
                (openPrefFor === person.id ? (
                  <div className="mt-3 pt-3 border-t border-gold-light/40 space-y-2">
                    <div className="flex bg-cream rounded-full border border-gold-light/60 p-0.5 text-xs">
                      {(['like', 'dislike', 'allergy', 'sensitivity'] as PreferenceType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setPrefType(t)}
                          className={`flex-1 py-1.5 rounded-full transition-colors ${
                            prefType === t ? 'bg-gold-dark text-white' : 'text-charcoal/60'
                          }`}
                        >
                          {PREFERENCE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject (e.g. peanuts, cilantro)"
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-1.5 text-xs">
                      {(['none', 'recipe', 'inventory_item'] as LinkType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setLink(t)}
                          className={`px-3 py-1 rounded-full border ${
                            linkType === t
                              ? 'bg-gold-dark text-white border-gold'
                              : 'bg-white text-charcoal/60 border-gold-light/60'
                          }`}
                        >
                          {t === 'none' ? 'No link' : t === 'recipe' ? 'Recipe' : 'Inventory item'}
                        </button>
                      ))}
                    </div>
                    {linkType !== 'none' && (
                      <div>
                        {linkedItem ? (
                          <div className="flex items-center justify-between border border-gold-light/60 rounded-xl px-3 py-2 text-sm">
                            <span className="text-charcoal truncate">{linkedItem.name}</span>
                            <button
                              onClick={() => setLinkedItem(null)}
                              className="text-charcoal/30 hover:text-rust shrink-0 ml-2"
                              aria-label="Clear selection"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              value={linkSearch}
                              onChange={(e) => setLinkSearch(e.target.value)}
                              placeholder={linkType === 'recipe' ? 'Search recipes…' : 'Search inventory…'}
                              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm mb-1"
                            />
                            {linkSearch.trim() && (
                              <div className="max-h-36 overflow-y-auto border border-gold-light/40 rounded-xl divide-y divide-gold-light/20">
                                {filteredLookup.length === 0 && (
                                  <p className="px-3 py-2 text-xs text-charcoal/40">No matches.</p>
                                )}
                                {filteredLookup.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => setLinkedItem(item)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10 truncate"
                                  >
                                    {item.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <textarea
                      value={prefNotes}
                      onChange={(e) => setPrefNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      rows={2}
                      className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOpenPrefFor(null)}
                        className="flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addPreference}
                        disabled={savingPref || !subject.trim()}
                        className="flex-1 py-2 rounded-full bg-charcoal text-cream font-medium text-xs disabled:opacity-40"
                      >
                        {savingPref ? 'Saving…' : 'Add preference'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openPreferenceForm(person.id)}
                    className="mt-2 text-xs font-medium text-gold-dark hover:text-charcoal"
                  >
                    + Add preference
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
