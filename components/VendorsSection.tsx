// components/VendorsSection.tsx
// SS-025. The VENDORS half of Contacts & Vendors.
//
// Two tables, one page, two sections, NEVER merged. suppliers are PLACES
// (Costco, Gourmet Glatt); household_contacts are PEOPLE (the plumber).
// They share a page because that is where you look when you need either,
// not because they are the same kind of thing -- a merged list would have
// to invent a shared shape and would lose `kind`, `delivers` and
// `kosher_supervision`, none of which mean anything for a person.
//
// NOT the same as components/SuppliersClient.tsx, which is easy to confuse
// with this and must not be. That one groups INVENTORY ITEMS by
// inventory_items.supplier for a purchasing view and never reads this
// table. This one is the directory of the suppliers table itself.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';
import { ExternalLink } from 'lucide-react';

type Supplier = {
  id: string;
  name: string;
  name_es: string | null;
  kind: string | null;
  kind_es: string | null;
  website: string | null;
  phone: string | null;
  delivers: boolean | null;
  kosher_supervision: string | null;
  notes: string | null;
  notes_es: string | null;
  sort_order: number;
};

const ALL = '__all__';

// THE CHIPS ARE BUILT FROM THE DATA, NOT FROM THE CHECK CONSTRAINT.
//
// suppliers_kind_check permits seven values but only five are in use, so a
// chip row driven by the constraint would render two chips that can never
// match anything. It is also the same rule the duty roster learned the hard
// way ("THE FREQUENCY LIST IS BUILT FROM DATA, NEVER HARDCODED") -- and it
// matters here specifically because the row count moved from 40 to 60 and
// the kind count from 4 to 5 while this was being written. A hardcoded list
// would already be stale.
//
// There is no kind_en column -- only `kind` (machine) and `kind_es`
// (Spanish display) -- so the English label is humanised from the stored
// value rather than read from a column that does not exist.
function humanise(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export default function VendorsSection({ propertyId }: { propertyId: string }) {
  const t = useTranslations('vendors');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<string>(ALL);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select(
        'id, name, name_es, kind, kind_es, website, phone, delivers, kosher_supervision, notes, notes_es, sort_order'
      )
      .eq('property_id', propertyId)
      .eq('active', true)
      // sort_order is the curated order (Amazon 10, Walmart 20 …); name is
      // only the tie-break, so equal-ranked rows stay stable.
      .order('sort_order')
      .order('name');
    setRows(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = (s: Supplier) => (es ? s.name_es || s.name : s.name);
  const displayKind = (s: Supplier) =>
    s.kind ? (es ? s.kind_es || humanise(s.kind) : humanise(s.kind)) : null;
  const displayNotes = (s: Supplier) => (es ? s.notes_es || s.notes : s.notes);

  // Chip list derives from what actually loaded, in the order the rows
  // themselves establish, so the chips follow sort_order rather than
  // alphabetising into an order nobody chose.
  const kinds = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of rows) {
      if (s.kind && !seen.has(s.kind)) seen.set(s.kind, displayKind(s) ?? s.kind);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, es]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (kind !== ALL && s.kind !== kind) return false;
      if (!q) return true;
      return [s.name, s.name_es, displayKind(s), s.notes, s.notes_es, s.kosher_supervision]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kind, search, es]);

  if (loading) return <SkeletonList />;

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-lg text-denim">{t('heading')}</h2>
        <span className="text-xs text-dusk shrink-0">{t('count', { count: rows.length })}</span>
      </div>
      <p className="text-sm text-dusk mb-3">{t('subtitle')}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-dusk text-center py-6">{t('empty')}</p>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2.5 bg-card mb-3 text-sm"
          />

          {/* Horizontally scrollable so a sixth or seventh kind cannot wrap
              the row into two lines on a phone. */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            <button
              onClick={() => setKind(ALL)}
              aria-pressed={kind === ALL}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
                kind === ALL
                  ? 'bg-denim text-white border-denim'
                  : 'bg-card text-dusk border-cardBorder'
              }`}
            >
              {t('allKinds')}
            </button>
            {kinds.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
                  kind === k.value
                    ? 'bg-denim text-white border-denim'
                    : 'bg-card text-dusk border-cardBorder'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-dusk text-center py-6">{t('noResults')}</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((s) => {
                const notes = displayNotes(s);
                const kindLabel = displayKind(s);
                return (
                  <li
                    key={s.id}
                    className="bg-card rounded-xl border border-cardBorder shadow-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-denim">{displayName(s)}</p>
                      {s.website && (
                        <a
                          href={s.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-dusk hover:text-denim flex items-center gap-1 shrink-0"
                        >
                          {t('visit')}
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {kindLabel && (
                        <span className="text-[11px] bg-mist text-dusk px-2 py-0.5 rounded-full">
                          {kindLabel}
                        </span>
                      )}
                      {s.delivers && (
                        <span className="text-[11px] bg-brass/15 text-brass px-2 py-0.5 rounded-full">
                          {t('delivers')}
                        </span>
                      )}
                      {/* Rendered only when set. Kashrut is never inferred
                          from `kind` -- a kosher_grocery row with no
                          supervision note shows no badge rather than an
                          assumed one. Every row is null today. */}
                      {s.kosher_supervision && (
                        <span className="text-[11px] bg-denim/10 text-denim px-2 py-0.5 rounded-full">
                          {s.kosher_supervision}
                        </span>
                      )}
                    </div>

                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="inline-block mt-1.5 text-sm text-dusk hover:text-denim"
                      >
                        📞 {s.phone}
                      </a>
                    )}

                    {notes && <p className="text-xs text-dusk mt-1.5">{notes}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
