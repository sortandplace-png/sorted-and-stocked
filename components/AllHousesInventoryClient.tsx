// components/AllHousesInventoryClient.tsx
// Cross-house inventory console (SS-399), built desktop-first per SS-400:
// this is a dense multi-house table and it is the one screen where a
// phone-width column would make it unusable. Real table with columns at
// lg+, stacked cards below -- not a stretched phone column.
//
// Read-only by design. No edit affordances at all: this is a purchasing
// overview, and the place to change an item is that house's own inventory.
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Home, Package, Search } from 'lucide-react';
import OrderLink from '@/components/OrderLink';
import { groupByProduct, type HouseInventoryRow, type HouseTally } from '@/lib/cross-house-inventory';

// Residence pill. Same visual language as the item card's location pill
// (w-3 h-3 brass icon + text-xs text-denim) as specified -- Home rather
// than MapPin because MapPin already means "room within a house" on the
// inventory card, and reusing it for the house itself would give one icon
// two meanings. No colour or shading encodes the residence: sage/rust/dairy
// already carry kashrut meaning and a second colour language would compete
// with the one that matters halachically.
function ResidencePill({ house, t }: { house: HouseTally; t: (k: string) => string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-mist border border-cardBorder rounded-full px-2 py-0.5 text-xs text-denim whitespace-nowrap">
      <Home className="w-3 h-3 shrink-0 text-brass" strokeWidth={1.75} aria-hidden="true" />
      {house.propertyName}
      {/* SS-379: a quantity of 0 usually means nobody has looked, not that
          we are out -- 1,497 of 1,582 items have never been counted. Those
          two states must not render identically on a screen used to make
          purchasing decisions, so never-counted shows as words and never
          as a number. */}
      {house.allNeverCounted ? (
        <span className="text-dusk italic">{t('neverCounted')}</span>
      ) : (
        <span className={house.isLow ? 'text-rust font-semibold' : 'text-denim font-semibold'}>
          {house.qty}
        </span>
      )}
      {house.rowCount > 1 && <span className="text-dusk">({t('rows')}&nbsp;{house.rowCount})</span>}
    </span>
  );
}

export default function AllHousesInventoryClient({
  rows,
  categories,
  houseCount,
  currentPropertyId,
}: {
  rows: HouseInventoryRow[];
  categories: string[];
  houseCount: number;
  currentPropertyId: string;
}) {
  const t = useTranslations('allHouses');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [multiHouseOnly, setMultiHouseOnly] = useState(false);

  const groups = useMemo(() => groupByProduct(rows), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (category && g.category !== category) return false;
      if (lowOnly && !g.anyLow) return false;
      if (multiHouseOnly && g.houses.length < 2) return false;
      if (!q) return true;
      return [g.displayName, g.displayNameEs].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [groups, search, category, lowOnly, multiHouseOnly]);

  const name = (g: { displayName: string; displayNameEs: string | null }) =>
    (locale === 'es' ? g.displayNameEs || g.displayName : g.displayName) ?? '';

  // Same pill treatment the Inventory page uses for its own stat toggles.
  const chip = (active: boolean) =>
    `text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
      active ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk hover:text-denim'
    }`;

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      <h1 className="font-display text-2xl text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-4">
        {t('subtitle', { products: groups.length, houses: houseCount })}
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="relative flex-1 min-w-[180px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dusk"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full border border-cardBorder rounded-full pl-9 pr-3 py-2 bg-mist text-sm text-denim"
          />
        </span>
        {/* Dropdown, not tabs -- tabs break past four residences, and this
            is the same select markup the Inventory page already uses. */}
        <select
          value={category ?? ''}
          onChange={(e) => setCategory(e.target.value || null)}
          className="border border-cardBorder rounded-full px-3 py-2 bg-mist text-sm text-denim"
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {/* Low stock is a FILTER, never the data source -- sourcing the
            console from the low-stock views would have shown 4 rows across
            1 house and left the residence grouping with nothing to draw. */}
        <button onClick={() => setLowOnly((v) => !v)} className={chip(lowOnly)}>
          {t('lowOnly')}
        </button>
        <button onClick={() => setMultiHouseOnly((v) => !v)} className={chip(multiHouseOnly)}>
          {t('multiHouseOnly')}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-dusk py-8 text-center">{t('empty')}</p>
      ) : (
        <>
          {/* ---- Desktop: real table ---- */}
          <div className="hidden lg:block rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-denim text-white text-[10px] uppercase tracking-[0.17em]">
                <tr>
                  <th className="text-left font-semibold py-[11px] px-5">{t('colProduct')}</th>
                  <th className="text-left font-semibold py-[11px] px-3">{t('colCategory')}</th>
                  <th className="text-left font-semibold py-[11px] px-3">{t('colHouses')}</th>
                  <th className="text-right font-semibold py-[11px] px-5">{t('colOrder')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cardBorder bg-card">
                {visible.map((g) => (
                  <tr key={g.key} className="hover:bg-mist/50 transition-colors">
                    <td className="py-2.5 px-5">
                      <span className="flex items-center gap-2.5">
                        {g.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-mist" />
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-mist shrink-0 flex items-center justify-center">
                            <Package size={14} strokeWidth={1.5} className="text-dusk" aria-hidden="true" />
                          </span>
                        )}
                        <span className="text-denim">{name(g)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-dusk">{g.category ?? '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className="flex flex-wrap gap-1.5">
                        {g.houses.map((h) => (
                          <ResidencePill key={h.propertyId} house={h} t={t} />
                        ))}
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      <span className="inline-flex justify-end">
                        <OrderLink itemName={g.displayName} sources={g.reorderSources} fallbackLink={g.reorderLink} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---- Mobile: stacked cards ---- */}
          <div className="lg:hidden space-y-2.5">
            {visible.map((g) => (
              <div key={g.key} className="bg-card border border-cardBorder rounded-xl2 shadow-card p-3">
                <div className="flex items-start gap-2.5">
                  {g.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-mist" />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-mist shrink-0 flex items-center justify-center">
                      <Package size={16} strokeWidth={1.5} className="text-dusk" aria-hidden="true" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-denim">{name(g)}</span>
                    {g.category && <span className="block text-xs text-dusk">{g.category}</span>}
                  </span>
                  <OrderLink itemName={g.displayName} sources={g.reorderSources} fallbackLink={g.reorderLink} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {g.houses.map((h) => (
                    <ResidencePill key={h.propertyId} house={h} t={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
