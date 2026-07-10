// components/StaplesTab.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { fetchStaplesWithInventory, addStapleToList } from '@/lib/api/staples';
import { Search, Plus, Check } from 'lucide-react';

type Staple = {
  staple_id: string;
  staple_name: string;
  staple_category: string;
  default_unit: string;
  inventory_item_id: string;
  current_qty: number;
  min_qty: number;
  location_id: string | null;
  is_low: boolean;
  already_on_list: boolean;
};

export default function StaplesTab({ propertyId, shoppingListId }: { propertyId: string; shoppingListId: string }) {
  const [staples, setStaples] = useState<Staple[]>([]);
  const [filteredStaples, setFilteredStaples] = useState<Staple[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'category' | 'name' | 'low-first'>('category');
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
      applyFiltersAndSort(data, searchTerm, sortBy);
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

  const applyFiltersAndSort = (items: Staple[], search: string, sort: string) => {
    let filtered = items.filter(s => s.staple_name.toLowerCase().includes(search.toLowerCase()));

    if (sort === 'category') {
      filtered.sort((a, b) => {
        if (a.staple_category !== b.staple_category) {
          return a.staple_category.localeCompare(b.staple_category);
        }
        return a.staple_name.localeCompare(b.staple_name);
      });
    } else if (sort === 'name') {
      filtered.sort((a, b) => a.staple_name.localeCompare(b.staple_name));
    } else if (sort === 'low-first') {
      filtered.sort((a, b) => {
        if (a.is_low !== b.is_low) return a.is_low ? -1 : 1;
        return a.staple_name.localeCompare(b.staple_name);
      });
    }

    setFilteredStaples(filtered);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    applyFiltersAndSort(staples, term, sortBy);
  };

  const handleSort = (sort: 'category' | 'name' | 'low-first') => {
    setSortBy(sort);
    applyFiltersAndSort(staples, searchTerm, sort);
  };

  const handleAddToList = async (staple: Staple) => {
    if (staple.already_on_list) return;

    setAddingIds(prev => new Set(prev).add(staple.staple_id));

    try {
      await addStapleToList(shoppingListId, staple.staple_id);

      // Update local state to reflect the addition
      setStaples(prev =>
        prev.map(s => (s.staple_id === staple.staple_id ? { ...s, already_on_list: true } : s))
      );
      applyFiltersAndSort(
        staples.map(s => (s.staple_id === staple.staple_id ? { ...s, already_on_list: true } : s)),
        searchTerm,
        sortBy
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
        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gold-light/20 hover:border-gold-light/40 transition-colors"
      >
        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-charcoal truncate">{staple.staple_name}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-charcoal/60">
            <span className="bg-gold-light/20 px-2 py-0.5 rounded-full text-charcoal font-medium">
              {staple.staple_category}
            </span>
            <span>{staple.default_unit}</span>
          </div>
        </div>

        {/* Stock Status */}
        <div className="flex flex-col items-end gap-1">
          <div
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              staple.current_qty === 0 && !staple.is_low
                ? 'bg-slate-200 text-slate-700'
                : staple.is_low
                  ? 'bg-rust/15 text-rust'
                  : 'bg-emerald-100/50 text-emerald-700'
            }`}
          >
            {staple.current_qty === 0 && !staple.is_low
              ? 'Not Yet Audited'
              : staple.is_low
                ? 'Low Stock'
                : `${staple.current_qty} in stock`}
          </div>
          {staple.is_low && <span className="text-[11px] text-charcoal/40">Min: {staple.min_qty}</span>}
        </div>

        {/* Add Button */}
        <button
          onClick={() => handleAddToList(staple)}
          disabled={staple.already_on_list || addingIds.has(staple.staple_id)}
          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
            staple.already_on_list
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : addingIds.has(staple.staple_id)
                ? 'bg-gold-light/40 text-charcoal'
                : 'bg-gold-light/60 text-charcoal hover:bg-gold-light/80'
          }`}
        >
          {staple.already_on_list ? (
            <Check className="h-4 w-4" />
          ) : addingIds.has(staple.staple_id) ? (
            <div className="animate-spin h-4 w-4 border-2 border-charcoal border-t-transparent rounded-full" />
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
        <div className="text-sm text-charcoal/50">Loading staples...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-charcoal/40" />
          <input
            type="text"
            placeholder="Search staples..."
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gold-light/40 rounded-full bg-white text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['category', 'name', 'low-first'] as const).map(option => (
            <button
              key={option}
              onClick={() => handleSort(option)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === option
                  ? 'bg-charcoal text-cream'
                  : 'bg-gold-light/20 text-charcoal hover:bg-gold-light/30'
              }`}
            >
              {option === 'category' && 'By Category'}
              {option === 'name' && 'By Name'}
              {option === 'low-first' && 'Low First'}
            </button>
          ))}
        </div>
      </div>

      {/* Staples Grid */}
      {filteredStaples.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-charcoal/40">
            {staples.length === 0
              ? 'No staples set up for this household yet.'
              : `No staples match "${searchTerm}" — try a different search.`}
          </p>
        </div>
      ) : groups ? (
        <div className="space-y-3">
          {groups.map(([key, groupStaples]) => {
            const collapsed = collapsedGroups.has(key);
            return (
              <div key={key}>
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center gap-2 mb-2 text-left"
                >
                  <span className="font-display text-lg text-charcoal">{key}</span>
                  <span className="text-xs text-charcoal/40">({groupStaples.length})</span>
                  <span className="flex-1 border-t border-gold-light/40" />
                  <span className="text-charcoal/40 text-sm">{collapsed ? '▸' : '▾'}</span>
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

      <div className="text-xs text-charcoal/40 pt-2 border-t border-gold-light/20">
        {filteredStaples.length} staples available
      </div>
    </div>
  );
}
