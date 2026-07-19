// components/HeaderSearchClient.tsx
// Replaces the old CommandPalette ("Find" -- recipes/inventory/locations by
// name) and AskTheHouseClient ("Ask the House" -- household_knowledge/
// household_contacts/person_food_preferences by name) with one trigger and
// one modal searching all six sources together. Both were plain ILIKE
// keyword search already -- "Ask the House"'s conversational name and
// placeholder ("WiFi? Plumber? Nut allergy?") made it read as AI-powered,
// but it never was; there is no natural-language query engine anywhere in
// this app. This consolidates the two real keyword searches into one real
// front door. It does NOT add genuine natural-language question answering
// ("what can I make for Shabbos with what's in the freezer?") -- that
// would mean a real LLM call with carefully scoped read access to
// inventory/recipes/meal-plan data, which is a substantial new feature on
// its own, not a UI consolidation. Flagged, not built silently.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Search, X } from 'lucide-react';
import ToolModal, { type ToolModalSlug } from '@/components/ToolModal';

type ResultKind = 'recipe' | 'inventory' | 'location' | 'knowledge' | 'contact' | 'preference';

type Result = {
  kind: ResultKind;
  id: string;
  primary: string;
  secondary: string | null;
  href?: string;
};

const RESULT_ORDER: ResultKind[] = ['recipe', 'inventory', 'location', 'knowledge', 'contact', 'preference'];

export default function HeaderSearchClient({ propertyId }: { propertyId: string }) {
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openTool, setOpenTool] = useState<ToolModalSlug | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const KIND_LABELS: Record<ResultKind, string> = {
    recipe: t('kindRecipe'),
    inventory: t('kindInventory'),
    location: t('kindLocation'),
    knowledge: t('kindKnowledge'),
    contact: t('kindContact'),
    preference: t('kindPreference'),
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      const [recipes, inventory, locations, knowledge, contacts, preferences] = await Promise.all([
        supabase
          .from('recipes')
          .select('id, name, recipe_property_links!inner(property_id)')
          .eq('recipe_property_links.property_id', propertyId)
          .ilike('name', like)
          .limit(5),
        supabase
          .from('inventory_items')
          .select('id, name, location_id')
          .eq('property_id', propertyId)
          .ilike('name', like)
          .limit(5),
        supabase.from('locations').select('id, name').eq('property_id', propertyId).ilike('name', like).limit(5),
        supabase
          .from('household_knowledge')
          .select('id, question, answer, category')
          .eq('property_id', propertyId)
          .or(`question.ilike.${like},answer.ilike.${like},category.ilike.${like}`)
          .limit(5),
        supabase
          .from('household_contacts')
          .select('id, name, role, notes, tags')
          .eq('property_id', propertyId)
          .or(`name.ilike.${like},role.ilike.${like},notes.ilike.${like}`)
          .limit(5),
        supabase
          .from('person_food_preferences')
          .select('id, preference_type, subject, notes, household_people(name)')
          .eq('property_id', propertyId)
          .or(`preference_type.ilike.${like},subject.ilike.${like},notes.ilike.${like}`)
          .limit(5),
      ]);

      const next: Result[] = [
        ...(recipes.data ?? []).map((r) => ({
          kind: 'recipe' as const,
          id: r.id,
          primary: r.name,
          secondary: null,
          href: `/properties/${propertyId}/recipes/${r.id}`,
        })),
        ...(inventory.data ?? []).map((i) => ({
          kind: 'inventory' as const,
          id: i.id,
          primary: i.name,
          secondary: null,
          // Deep-links straight to this exact item's detail view, not just
          // its room -- see InventoryClient's initialItemId handling.
          href: `/properties/${propertyId}/inventory?item=${i.id}`,
        })),
        ...(locations.data ?? []).map((l) => ({
          kind: 'location' as const,
          id: l.id,
          primary: l.name,
          secondary: null,
          href: `/properties/${propertyId}/inventory?location=${l.id}`,
        })),
        ...(knowledge.data ?? []).map((k) => ({
          kind: 'knowledge' as const,
          id: k.id,
          primary: k.question,
          secondary: k.answer,
        })),
        ...(contacts.data ?? []).map((c) => ({
          kind: 'contact' as const,
          id: c.id,
          primary: c.name,
          secondary: c.role ?? (c.tags && c.tags.length > 0 ? c.tags.join(', ') : null),
        })),
        ...(preferences.data ?? []).map((p: any) => ({
          kind: 'preference' as const,
          id: p.id,
          primary: `${p.household_people?.name ?? 'Someone'} — ${p.subject ?? p.preference_type}`,
          secondary: p.notes,
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
    if (result.href) {
      router.push(result.href);
    } else if (result.kind === 'knowledge') {
      setOpenTool('knowledge-base');
    } else if (result.kind === 'contact') {
      setOpenTool('contacts');
    } else {
      router.push(`/properties/${propertyId}/tools/taste-memory`);
    }
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition-colors"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {t('triggerLabel')}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-[80] pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-cardBorder w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cardBorder">
              <Search className="h-4 w-4 text-dusk shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t('placeholder')}
                className="flex-1 outline-none text-sm text-denim bg-transparent placeholder:text-dusk"
              />
              <button onClick={() => setOpen(false)} aria-label={t('close')} className="text-dusk hover:text-denim">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-sm text-dusk text-center">{t('searching')}</p>}
              {!loading && query.trim() && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-dusk text-center">{t('noResults')}</p>
              )}
              {!loading &&
                RESULT_ORDER.map((kind) => {
                  const group = results.filter((r) => r.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <div key={kind}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-brass">
                        {KIND_LABELS[kind]}
                      </p>
                      {group.map((r) => {
                        const globalIndex = results.indexOf(r);
                        return (
                          <button
                            key={`${r.kind}-${r.id}`}
                            onClick={() => selectResult(r)}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            className={`w-full text-left px-4 py-2.5 transition-colors ${
                              globalIndex === activeIndex ? 'bg-mist' : 'hover:bg-mist/50'
                            }`}
                          >
                            <p className="text-sm text-denim truncate">{r.primary}</p>
                            {r.secondary && <p className="text-xs text-dusk truncate">{r.secondary}</p>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
            </div>

            <div className="px-4 py-2 border-t border-cardBorder text-[10px] text-dusk flex items-center gap-3">
              <span>↑↓ {t('navigate')}</span>
              <span>↵ {t('open')}</span>
              <span>esc {t('close')}</span>
            </div>
          </div>
        </div>
      )}

      {openTool && <ToolModal slug={openTool} propertyId={propertyId} onClose={() => setOpenTool(null)} />}
    </>
  );
}
