// components/CrossPropertyLowStockClient.tsx
// SS-013. Cross-property low stock -- the shared buying view.
//
// get_low_stock_all_properties(p_only_multi) is SECURITY INVOKER over
// v_low_stock_combined (migration 211), which itself reads inventory_items
// and properties with RLS enabled on both. That means the RPC already
// scopes itself to whatever properties the calling user can see -- there
// is no manual property filter to add here, and adding one would only
// risk disagreeing with what the database already enforces.
//
// The default view is p_only_multi = true: items low in MORE than one
// house are the reason this page exists (one Costco run instead of five
// separate lists that all say "Olive Oil"). The toggle to "everywhere"
// (false) is the fallback for a single-house or low-multi-house account
// where the multi view would be empty.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';

type Row = {
  name: string;
  name_es: string | null;
  category: string | null;
  kosher_type: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  houses_needing: number;
  which_houses: string | null;
  total_short: number;
};

// Real live values are lowercase ('meat' | 'dairy' | 'parve') -- confirmed
// against inventory_items.kosher_type before writing this, rather than
// copied from components/ShoppingListViewEnhanced.tsx's KOSHER_PILL_STYLE,
// whose keys are capitalized ('Meat' | 'Dairy' | 'Parve') and so never
// match a real row. That mismatch is pre-existing there and out of scope
// here; this map is keyed to what the column actually contains.
const KOSHER_PILL_STYLE: Record<string, string> = {
  meat: 'bg-rust/15 text-rust',
  dairy: 'bg-dairy/15 text-dairy',
  parve: 'bg-sage/15 text-sage',
};

export default function CrossPropertyLowStockClient() {
  const t = useTranslations('crossPropertyLowStock');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  const [onlyMulti, setOnlyMulti] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (multi: boolean) => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase.rpc('get_low_stock_all_properties', {
        p_only_multi: multi,
      });
      if (err) {
        setError(true);
        setLoading(false);
        return;
      }
      setRows((data ?? []) as Row[]);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    load(onlyMulti);
  }, [load, onlyMulti]);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-4">{t('subtitle')}</p>

      {/* Two-way toggle, not a checkbox: "shared" and "everywhere" are both
          first-class views of the same data, not a default plus an
          override. */}
      <div className="flex gap-1.5 mb-4">
        <button
          onClick={() => setOnlyMulti(true)}
          aria-pressed={onlyMulti}
          className={`flex-1 text-sm px-3 py-2 rounded-full border font-medium ${
            onlyMulti ? 'bg-denim text-white border-denim' : 'bg-card text-dusk border-cardBorder'
          }`}
        >
          {t('sharedView')}
        </button>
        <button
          onClick={() => setOnlyMulti(false)}
          aria-pressed={!onlyMulti}
          className={`flex-1 text-sm px-3 py-2 rounded-full border font-medium ${
            !onlyMulti ? 'bg-denim text-white border-denim' : 'bg-card text-dusk border-cardBorder'
          }`}
        >
          {t('everywhereView')}
        </button>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <p className="text-sm text-rust text-center py-8">{t('loadError')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8">
          {onlyMulti ? t('emptyShared') : t('emptyEverywhere')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const displayName = es ? r.name_es || r.name : r.name;
            const kosherStyle = r.kosher_type ? KOSHER_PILL_STYLE[r.kosher_type] : null;
            return (
              <li
                key={r.name}
                className="bg-card rounded-xl border border-cardBorder shadow-card p-3 flex gap-3"
              >
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photo_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0 bg-mist"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg shrink-0 bg-mist" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-denim">{displayName}</p>
                    {/* Plural-house badge only when it actually IS more than
                        one house -- the everywhere view includes single-
                        house rows, and a "1 house" badge would be noise. */}
                    {r.houses_needing > 1 && (
                      <span className="shrink-0 text-[11px] bg-brass/15 text-brass px-2 py-0.5 rounded-full">
                        {t('housesNeeding', { count: r.houses_needing })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {kosherStyle && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${kosherStyle}`}>
                        {r.kosher_type}
                      </span>
                    )}
                    {r.category && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-mist text-dusk">
                        {r.category}
                      </span>
                    )}
                  </div>
                  {r.which_houses && <p className="text-xs text-dusk mt-1">{r.which_houses}</p>}
                  {r.reorder_link ? (
                    <a
                      href={r.reorder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-xs text-denim underline"
                    >
                      {t('reorder')}
                    </a>
                  ) : (
                    <p className="text-xs text-dusk mt-1.5">{t('noReorderLink')}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
