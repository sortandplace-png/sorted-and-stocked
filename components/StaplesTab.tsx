// components/StaplesTab.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { fetchStaplesWithInventory, addStapleToList } from '@/lib/api/staples';
import { Search, Plus, Check } from 'lucide-react';
import Pin from '@/components/PinAccent';
import { CardHeader } from '@/components/ShiftHandoverClient';
import PhotoOrFallback from '@/components/PhotoOrFallback';

type Staple = {
  staple_id: string;
  staple_name: string;
  staple_category: string;
  default_unit: string;
  inventory_item_id: string;
  current_qty: number;
  min_qty: number;
  location_id: string | null;
  photo_url: string | null;
  is_low: boolean;
  already_on_list: boolean;
  last_counted_at: string | null;
  hechsher: string | null;
};

export default function StaplesTab({ propertyId, shoppingListId }: { propertyId: string; shoppingListId: string }) {
  const [staples, setStaples] = useState<Staple[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'category' | 'name' | 'low-first'>('category');
  // Same category-dropdown + "Below par only" pattern as the main
  // Inventory page's Rooms filter bar -- reused exactly, not a second
  // filter UI. Sort modes above still control ordering; these narrow.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [belowParOnly, setBelowParOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  // Collapsible sections -- same title+count+chevron pattern as the Recipes
  // grid, applied per-category (Category sort) or per-letter (Name sort).
  // Low First stays a flat list since it's a short priority ranking, not a
  // long alphabetical browse -- collapsing 2 buckets wouldn't help.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const showToast = useToast();

  // Fetch all staples with their inventory details
  const loadStaples = async () => {
    setLoading(true);
    try {
      const data = await fetchStaplesWithInventory(propertyId, shoppingListId);
      setStaples(data);
      // collapsedGroups previously stayed an empty Set forever -- the
      // toggle mechanism (arrows, per-group show/hide) was real, but
      // nothing ever populated it on load, so every category rendered
      // expanded by default despite that being the actual point. Default
      // sort is 'category', so pre-collapse by real category name here to
      // match Recipe Ingredients' already-live default-collapsed pattern.
      setCollapsedGroups(new Set(data.map((s) => s.staple_category)));
    } catch (error) {
      console.error('Error loading staples:', error);
      showToast('Failed to load staples.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaples();
  }, [propertyId, shoppingListId]);

  // Real categories from the actual loaded staples, same as Inventory's
  // categorySuggestions -- not a hardcoded list that could drift.
  const categorySuggestions = useMemo(
    () => [...new Set(staples.map((s) => s.staple_category))].sort((a, b) => a.localeCompare(b)),
    [staples]
  );

  // Derived instead of imperatively recomputed on every handler -- removes
  // a whole class of "forgot to pass the new filter param here" bugs now
  // that there are two filters (category, below-par) on top of search+sort.
  const filteredStaples = useMemo(() => {
    let filtered = staples.filter((s) => s.staple_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (categoryFilter) filtered = filtered.filter((s) => s.staple_category === categoryFilter);
    if (belowParOnly) filtered = filtered.filter((s) => s.is_low);

    filtered = [...filtered];
    if (sortBy === 'category') {
      filtered.sort((a, b) => {
        if (a.staple_category !== b.staple_category) {
          return a.staple_category.localeCompare(b.staple_category);
        }
        return a.staple_name.localeCompare(b.staple_name);
      });
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.staple_name.localeCompare(b.staple_name));
    } else if (sortBy === 'low-first') {
      filtered.sort((a, b) => {
        if (a.is_low !== b.is_low) return a.is_low ? -1 : 1;
        return a.staple_name.localeCompare(b.staple_name);
      });
    }
    return filtered;
  }, [staples, searchTerm, sortBy, categoryFilter, belowParOnly]);

  const handleAddToList = async (staple: Staple) => {
    if (staple.already_on_list) return;

    setAddingIds(prev => new Set(prev).add(staple.staple_id));

    try {
      await addStapleToList(shoppingListId, staple.staple_id);

      // Update local state to reflect the addition
      setStaples(prev =>
        prev.map(s => (s.staple_id === staple.staple_id ? { ...s, already_on_list: true } : s))
      );

      showToast(`Added ${staple.staple_name} to shopping list.`, { variant: 'success' });
    } catch (error) {
      console.error('Error adding staple:', error);
      showToast('Failed to add staple to list.', { variant: 'error' });
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(staple.staple_id);
        return next;
      });
    }
  };

  function renderStapleCard(staple: Staple) {
    return (
      <div
        key={staple.staple_id}
        className="flex items-center gap-3 p-3 bg-card rounded-xl2 border border-cardBorder hover:border-brass/40 transition-colors"
      >
        <PhotoOrFallback src={staple.photo_url} alt="" sizeClass="w-10 h-10" rounded="rounded-lg" className="shrink-0" />

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-denim truncate">{staple.staple_name}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-dusk">
            <span className="bg-mist px-2 py-0.5 rounded-full text-denim font-medium">
              {staple.staple_category}
            </span>
            <span>{staple.default_unit}</span>
            {staple.hechsher && (
              <span className="bg-dairy/15 px-2 py-0.5 rounded-full text-dairy truncate max-w-[10rem]">
                {staple.hechsher}
              </span>
            )}
          </div>
        </div>

        {/* Stock Status */}
        <div className="flex flex-col items-end gap-1">
          <div
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              staple.last_counted_at === null
                ? 'bg-mist text-dusk'
                : staple.is_low
                  ? 'bg-rust/15 text-rust'
                  : 'bg-sage/10 text-sage'
            }`}
          >
            {staple.last_counted_at === null
              ? 'Not Yet Audited'
              : staple.is_low
                ? 'Low Stock'
                : `${staple.current_qty} in stock`}
          </div>
          {staple.is_low && <span className="text-[11px] text-dusk">Min: {staple.min_qty}</span>}
        </div>

        {/* Add Button */}
        <button
          onClick={() => handleAddToList(staple)}
          disabled={staple.already_on_list || addingIds.has(staple.staple_id)}
          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
            staple.already_on_list
              ? 'bg-sage/15 text-sage cursor-default'
              : addingIds.has(staple.staple_id)
                ? 'bg-mist text-denim'
                : 'bg-mist text-denim border border-brass/30 hover:bg-card'
          }`}
        >
          {staple.already_on_list ? (
            <Check className="h-4 w-4" />
          ) : addingIds.has(staple.staple_id) ? (
            <div className="animate-spin h-4 w-4 border-2 border-denim border-t-transparent rounded-full" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const groups = useMemo(() => {
    if (sortBy === 'low-first') return null;
    const map = new Map<string, Staple[]>();
    for (const s of filteredStaples) {
      const key =
        sortBy === 'category'
          ? s.staple_category
          : /[A-Z]/.test(s.staple_name.trim().charAt(0).toUpperCase())
            ? s.staple_name.trim().charAt(0).toUpperCase()
            : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [filteredStaples, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-dusk">Loading staples...</div>
      </div>
    );
  }

  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" />
      {/* Renamed from "Household Staples" per Racquel's direct approval
          (2026-07-21). t('householdStaplesTab') in messages/en.json /
          es.json is the source of truth for the actual tab button above
          this component; this literal string just needs to stay in sync
          with it. */}
      <CardHeader>Household Supplies & Non-Foods</CardHeader>
      <div className="p-4 space-y-4">
        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-dusk" />
            <input
              type="text"
              placeholder="Search staples..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-cardBorder rounded-full bg-card text-sm focus:outline-none focus:border-brass focus:ring-2 focus:ring-brass/30"
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={categoryFilter ?? ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="border border-cardBorder rounded-full px-3 py-2 bg-card text-sm text-denim"
            >
              <option value="">All categories</option>
              {categorySuggestions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => setBelowParOnly((v) => !v)}
              className={`text-sm px-4 py-2 rounded-full border shrink-0 ${
                belowParOnly ? 'bg-rust text-white border-rust' : 'border-cardBorder text-denim'
              }`}
            >
              Below par only
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['category', 'name', 'low-first'] as const).map(option => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  sortBy === option
                    ? 'bg-denim text-white'
                    : 'bg-mist text-denim hover:bg-card'
                }`}
              >
                {option === 'category' && 'By Category'}
                {option === 'name' && 'By Name'}
                {option === 'low-first' && 'Low First'}
              </button>
            ))}
          </div>
        </div>

        {staples.some((s) => s.hechsher) && (
          <p className="text-[11px] text-dusk px-1">
            Hechsher shown here is a starting reference — always confirm against the actual product label before use.
          </p>
        )}

        {/* Staples Grid */}
        {filteredStaples.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-dusk">
              {staples.length === 0
                ? 'No staples set up for this household yet.'
                : `No staples match "${searchTerm}" — try a different search.`}
            </p>
          </div>
        ) : groups ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
            {groups.map(([key, groupStaples]) => {
              const collapsed = collapsedGroups.has(key);
              const lowCount = groupStaples.filter((s) => s.is_low).length;
              return (
                <div key={key} className="bg-card border border-cardBorder rounded-xl2 shadow-card p-4">
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-3 mb-2 text-left"
                  >
                    <span className="font-display text-lg text-denim">{key}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brass">
                      {groupStaples.length} {groupStaples.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="flex-1" />
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        lowCount > 0 ? 'bg-rust/15 text-rust' : 'bg-sage/10 text-sage'
                      }`}
                    >
                      {lowCount > 0 ? `${lowCount} below par` : 'All stocked'}
                    </span>
                    <span className="text-dusk text-sm shrink-0">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && (
                    <div className="space-y-3">{groupStaples.map(renderStapleCard)}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">{filteredStaples.map(renderStapleCard)}</div>
        )}

        <div className="text-xs text-dusk pt-2 border-t border-cardBorder">
          {filteredStaples.length} staples available
        </div>
      </div>
    </div>
  );
}
