// components/DietaryTaggingClient.tsx
// Universal sibling of KosherTypeTaggingClient (observance gating
// amendment, 31 Jul 2026): every property gets this tool, always on --
// it is NOT the non-Jewish replacement for Kosher Type Tagging, which
// shows in addition to it on Jewish-observant properties.
//
// Same bulk shape as its sibling: food-category items with no reviewed
// dietary_tags yet (IS NULL -- an empty array is a real reviewed
// "checked, none apply"), grouped by their existing category so a
// manager can select-all, uncheck real exceptions, pick the tags that
// apply, and write them in one action. Never a silent auto-tag from the
// category name -- someone always chooses the tags explicitly.
//
// Tag colors are the dietaryTag token set (Concept B palette,
// tailwind.config.ts) -- rust/dairy/sage stay reserved for Meat/Dairy/
// Parve only, per the amendment.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { isFoodCategory } from '@/lib/foodCategories';

type Item = { id: string; name: string; category: string | null };

// Same vocabulary the dietary_tags column comment documents (migration
// 168), so the tool and the schema promise can't drift apart.
const DIETARY_TAGS = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free'];

export default function DietaryTaggingClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which tags each category group would apply -- per group rather than
  // global, so tagging Produce Vegan doesn't silently arm Vegan on Dairy.
  const [groupTags, setGroupTags] = useState<Record<string, Set<string>>>({});
  const [applyingCategory, setApplyingCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, category')
      .eq('property_id', propertyId)
      .is('dietary_tags', null)
      .order('name');
    setItems((data ?? []).filter((i) => isFoodCategory(i.category)));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(groupItems: Item[]) {
    setSelected((prev) => new Set([...prev, ...groupItems.map((i) => i.id)]));
  }

  function clearGroup(groupItems: Item[]) {
    const groupIds = new Set(groupItems.map((i) => i.id));
    setSelected((prev) => new Set([...prev].filter((id) => !groupIds.has(id))));
  }

  function toggleGroupTag(category: string, tag: string) {
    setGroupTags((prev) => {
      const next = new Set(prev[category] ?? []);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...prev, [category]: next };
    });
  }

  async function applyToGroup(category: string, groupItems: Item[], tags: string[]) {
    const ids = groupItems.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (ids.length === 0) return;
    setApplyingCategory(category);
    const { error } = await supabase.from('inventory_items').update({ dietary_tags: tags }).in('id', ids);
    setApplyingCategory(null);
    if (error) {
      showToast('Failed to tag — try again.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    showToast(
      tags.length === 0
        ? `Marked ${ids.length} item${ids.length === 1 ? '' : 's'} — no dietary tags apply.`
        : `Tagged ${ids.length} item${ids.length === 1 ? '' : 's'}: ${tags.join(', ')}.`,
      { variant: 'success' }
    );
  }

  if (!canManage(role)) {
    return <p className="max-w-md lg:max-w-2xl mx-auto p-4 text-sm text-dusk">Only an owner or manager can use this tool.</p>;
  }

  if (loading) return <SkeletonList />;

  const groups = Object.entries(
    items.reduce((acc: Record<string, Item[]>, item) => {
      const key = item.category ?? 'Uncategorized';
      (acc[key] ??= []).push(item);
      return acc;
    }, {})
  )
    .map(([category, groupItems]) => ({ category, groupItems }))
    .sort((a, b) => b.groupItems.length - a.groupItems.length);

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Dietary Tagging</h1>
      <p className="text-sm text-dusk mb-5">
        {items.length} item{items.length === 1 ? '' : 's'} with no dietary tags on file yet, grouped by category.
        Select items, pick the tags that apply, then tag them in one click.
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-white rounded-2xl shadow-sm shadow-black/5">
          Nothing left to tag.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ category, groupItems }) => {
            const groupSelectedCount = groupItems.filter((i) => selected.has(i.id)).length;
            const tags = groupTags[category] ?? new Set<string>();
            const busy = applyingCategory === category;
            return (
              <div key={category} className="bg-white rounded-2xl shadow-sm shadow-black/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-base text-denim">
                    {category} <span className="text-dusk font-normal text-sm">({groupItems.length})</span>
                  </h2>
                  <div className="flex gap-2 text-xs font-medium text-brass">
                    <button onClick={() => selectAllInGroup(groupItems)}>Select all</button>
                    <button onClick={() => clearGroup(groupItems)}>Clear</button>
                  </div>
                </div>

                <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-center gap-2 py-1 text-sm text-denim cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="rounded border-cardBorder text-brass"
                        />
                        {item.name}
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-1.5 flex-wrap mb-3">
                  {DIETARY_TAGS.map((tag) => {
                    const on = tags.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleGroupTag(category, tag)}
                        aria-pressed={on}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          on
                            ? 'bg-dietaryTag-bg text-dietaryTag border-dietaryTag-border'
                            : 'bg-white text-dusk border-cardBorder hover:border-dietaryTag-border/60'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-dusk">{groupSelectedCount} selected</span>
                  <button
                    onClick={() => applyToGroup(category, groupItems, [...tags].sort())}
                    disabled={busy || groupSelectedCount === 0 || tags.size === 0}
                    className="text-xs font-medium text-white bg-denim px-3 py-1.5 rounded-full disabled:opacity-40"
                  >
                    {busy ? '…' : `Tag ${tags.size > 0 ? [...tags].join(' + ') : 'selected'}`}
                  </button>
                  <button
                    onClick={() => applyToGroup(category, groupItems, [])}
                    disabled={busy || groupSelectedCount === 0 || tags.size > 0}
                    className="text-xs text-dusk disabled:opacity-40"
                  >
                    None apply
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
