// components/CommandPalette.tsx
// Cmd+K / Ctrl+K global search — recipes, inventory items, and locations by
// name (the spec's "at minimum" set). Shopping list and meal plan search
// were flagged as add-if-straightforward — they're not included here: both
// need query logic distinct from a simple name search (shopping list items
// aren't reliably named things people would search for by name the way a
// recipe or product is, and meal plan entries are date-indexed, not
// name-indexed), so they're a real follow-up, not a quick addition.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Search, X } from 'lucide-react';

type ResultKind = 'recipe' | 'inventory' | 'location';

type Result = {
  kind: ResultKind;
  id: string;
  name: string;
  href: string;
};

const KIND_LABELS: Record<ResultKind, string> = {
  recipe: 'Recipe',
  inventory: 'Inventory',
  location: 'Location',
};

export default function CommandPalette({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    // Lets a plain header button open the palette too — Cmd+K alone has
    // zero discoverability for anyone who doesn't already know it exists.
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener('open-command-palette', onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-command-palette', onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const like = `%${q.trim()}%`;
      const [recipes, inventory, locations] = await Promise.all([
        supabase
          .from('recipes')
          .select('id, name, recipe_property_links!inner(property_id)')
          .eq('recipe_property_links.property_id', propertyId)
          .ilike('name', like)
          .limit(6),
        supabase
          .from('inventory_items')
          .select('id, name, location_id')
          .eq('property_id', propertyId)
          .ilike('name', like)
          .limit(6),
        supabase.from('locations').select('id, name').eq('property_id', propertyId).ilike('name', like).limit(6),
      ]);

      const next: Result[] = [
        ...(recipes.data ?? []).map((r) => ({
          kind: 'recipe' as const,
          id: r.id,
          name: r.name,
          href: `/properties/${propertyId}/recipes/${r.id}`,
        })),
        ...(inventory.data ?? []).map((i) => ({
          kind: 'inventory' as const,
          id: i.id,
          name: i.name,
          href: `/properties/${propertyId}/inventory${i.location_id ? `?location=${i.location_id}` : ''}`,
        })),
        ...(locations.data ?? []).map((l) => ({
          kind: 'location' as const,
          id: l.id,
          name: l.name,
          href: `/properties/${propertyId}/inventory?location=${l.id}`,
        })),
      ];
      setResults(next);
      setActiveIndex(0);
      setLoading(false);
    },
    [propertyId, supabase]
  );

  useEffect(() => {
    const handle = setTimeout(() => search(query), 200);
    return () => clearTimeout(handle);
  }, [query, search]);

  function selectResult(result: Result) {
    setOpen(false);
    router.push(result.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      selectResult(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-[80] pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gold-light/40">
          <Search className="h-4 w-4 text-charcoal/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search recipes, inventory, locations…"
            className="flex-1 outline-none text-sm text-charcoal bg-transparent"
          />
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-charcoal/40 hover:text-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-sm text-charcoal/40 text-center">Searching…</p>}
          {!loading && query.trim() && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-charcoal/40 text-center">No matches.</p>
          )}
          {!loading &&
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => selectResult(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm ${
                  i === activeIndex ? 'bg-gold-light/20' : ''
                }`}
              >
                <span className="text-charcoal truncate">{r.name}</span>
                <span className="text-[10px] font-medium text-gold-dark bg-gold-light/40 px-2 py-0.5 rounded-full shrink-0">
                  {KIND_LABELS[r.kind]}
                </span>
              </button>
            ))}
        </div>

        <div className="px-4 py-2 border-t border-gold-light/30 text-[10px] text-charcoal/30 flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
