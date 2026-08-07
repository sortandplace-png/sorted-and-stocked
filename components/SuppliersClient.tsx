// components/SuppliersClient.tsx
// SS-025. One section per store, ordered by how much of the inventory comes
// from it -- the useful order for a purchasing view, where Instacart at 488
// items matters more than Bingo Wholesale at 1.
//
// Sections start COLLAPSED. Two of these stores carry 400+ items each; open
// by default this page would be a four-thousand-line wall before the reader
// reached the second heading. The counts are on the headers, so the summary
// is readable without expanding anything.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Pin from '@/components/ui/Pin';
import { ExternalLink } from 'lucide-react';

export type Supplier = {
  name: string;
  items: { id: string; name: string; nameEs: string | null; reorderUrl: string | null }[];
};

export default function SuppliersClient({
  propertyId,
  suppliers,
}: {
  propertyId: string;
  suppliers: Supplier[];
}) {
  const t = useTranslations('suppliers');
  const locale = useLocale();
  const es = locale === 'es';

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const itemName = (i: Supplier['items'][number]) => (es && i.nameEs ? i.nameEs : i.name);

  // Search matches the store OR anything it supplies, and auto-expands the
  // matches -- searching for an item you cannot see inside a collapsed
  // section would otherwise return sections that look empty.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers
      .map((s) => {
        if (s.name.toLowerCase().includes(q)) return s;
        const items = s.items.filter((i) => itemName(i).toLowerCase().includes(q));
        return items.length > 0 ? { ...s, items } : null;
      })
      .filter((s): s is Supplier => s !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, query, es]);

  const searching = query.trim().length > 0;
  const totalItems = suppliers.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
        <p className="text-sm text-dusk mb-5">
          {t('subtitle', { stores: suppliers.length, items: totalItems })}
        </p>

        {suppliers.length === 0 ? (
          <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
            {t('empty')}
          </p>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full mb-4 bg-card border border-cardBorder rounded-full px-4 py-2 text-[13px] text-denim placeholder:text-dusk focus:border-brass focus:outline-none"
            />

            {visible.length === 0 ? (
              <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
                {t('noResults')}
              </p>
            ) : (
              <div className="space-y-[14px]">
                {visible.map((s) => {
                  const expanded = searching || open.has(s.name);
                  return (
                    <div key={s.name}>
                      <div className="relative">
                        <button
                          onClick={() => toggle(s.name)}
                          aria-expanded={expanded}
                          className="w-full flex items-center justify-between gap-3 bg-denim rounded-xl2 py-[11px] pl-5 pr-8 text-left"
                        >
                          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white truncate">
                            {s.name}
                          </span>
                          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 shrink-0">
                            {t('itemCount', { count: s.items.length })}
                          </span>
                        </button>
                        <Pin size="sm" collapsed={!expanded} onToggle={() => toggle(s.name)} />
                      </div>

                      {expanded && (
                        <ul className="mt-[14px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[14px]">
                          {s.items.map((i) => (
                            <li
                              key={i.id}
                              className="relative bg-card rounded-xl2 border border-cardBorder shadow-card p-3.5 pr-8 flex items-start gap-2"
                            >
                              <span className="flex-1 min-w-0">
                                <span className="block text-[14px] text-denim leading-snug">
                                  {itemName(i)}
                                </span>
                                {i.reorderUrl ? (
                                  <a
                                    href={i.reorderUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-1 text-[12px] font-medium text-denim underline underline-offset-2"
                                  >
                                    {t('reorder')}
                                    <ExternalLink size={11} strokeWidth={1.75} aria-hidden="true" />
                                  </a>
                                ) : (
                                  // Said plainly rather than left blank, so
                                  // "no link" reads as a known state instead
                                  // of something that failed to load.
                                  <span className="block mt-1 text-[12px] text-dusk italic">
                                    {t('noReorderLink')}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <Link
          href={`/properties/${propertyId}/inventory`}
          className="inline-block mt-8 text-[13px] text-dusk hover:text-denim transition-colors"
        >
          {t('openInventory')}
        </Link>
      </div>
    </div>
  );
}
