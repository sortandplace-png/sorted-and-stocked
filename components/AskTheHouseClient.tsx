// components/AskTheHouseClient.tsx
// One search across the three real, already-populated "who do I ask / what
// do I need to know" tables -- household_knowledge (Q&A), household_contacts
// (vendors/repairs/help), and person_food_preferences (allergies, likes,
// dislikes). Same modal shell as CommandPalette.tsx, but a distinct search
// with distinct data -- CommandPalette answers "find this recipe/item/room
// by name," this answers "who do I call" / "what's the WiFi password" /
// "can this person eat X." Clicking a result can't deep-link into one
// specific Q&A entry or contact (none of the three underlying tools have
// per-row anchors) -- it opens the real tool itself so the answer is
// visible to scan, same honesty as CommandPalette's own result list.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Search, X } from 'lucide-react';
import ToolModal, { type ToolModalSlug } from '@/components/ToolModal';

type ResultKind = 'knowledge' | 'contact' | 'preference';

type Result = {
  kind: ResultKind;
  id: string;
  primary: string;
  secondary: string | null;
};

const KIND_LABELS: Record<ResultKind, string> = {
  knowledge: 'House Manual',
  contact: 'Contact',
  preference: 'Taste & Preferences',
};

export default function AskTheHouseClient({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [openTool, setOpenTool] = useState<ToolModalSlug | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const like = `%${q.trim()}%`;
      const [knowledge, contacts, preferences] = await Promise.all([
        supabase
          .from('household_knowledge')
          .select('id, question, answer, category')
          .eq('property_id', propertyId)
          .or(`question.ilike.${like},answer.ilike.${like},category.ilike.${like}`)
          .limit(8),
        supabase
          .from('household_contacts')
          .select('id, name, role, notes, tags')
          .eq('property_id', propertyId)
          .or(`name.ilike.${like},role.ilike.${like},notes.ilike.${like}`)
          .limit(8),
        supabase
          .from('person_food_preferences')
          .select('id, preference_type, subject, notes, household_people(name)')
          .eq('property_id', propertyId)
          .or(`preference_type.ilike.${like},subject.ilike.${like},notes.ilike.${like}`)
          .limit(8),
      ]);

      const next: Result[] = [
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
    if (result.kind === 'knowledge') setOpenTool('knowledge-base');
    else if (result.kind === 'contact') setOpenTool('contacts');
    else router.push(`/properties/${propertyId}/tools/taste-memory`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 rounded-full border border-gold-light/60 px-3 py-1.5 text-xs text-charcoal/60 hover:bg-gold-light/10 transition-colors"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        Ask the House
      </button>

      {open && (
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
                placeholder="Ask the house… WiFi? Plumber? Nut allergy?"
                className="flex-1 outline-none text-sm text-charcoal bg-transparent"
              />
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-charcoal/40 hover:text-charcoal">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-sm text-charcoal/40 text-center">Searching…</p>}
              {!loading && query.trim() && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-charcoal/40 text-center">
                  No matches — try House Manual, Contacts, or Taste Memory directly.
                </p>
              )}
              {!loading &&
                (['knowledge', 'contact', 'preference'] as ResultKind[]).map((kind) => {
                  const group = results.filter((r) => r.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <div key={kind}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-gold-dark">
                        {KIND_LABELS[kind]}
                      </p>
                      {group.map((r) => (
                        <button
                          key={`${r.kind}-${r.id}`}
                          onClick={() => selectResult(r)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gold-light/10"
                        >
                          <p className="text-sm text-charcoal truncate">{r.primary}</p>
                          {r.secondary && <p className="text-xs text-charcoal/50 truncate">{r.secondary}</p>}
                        </button>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {openTool && <ToolModal slug={openTool} propertyId={propertyId} onClose={() => setOpenTool(null)} />}
    </>
  );
}
