// components/RecipePrepLeadDays.tsx
// v1 of the prep-timeline idea: a single lead-time number per recipe rather
// than a full backwards-scheduling engine. "2" means the dashboard should
// remind 2 days before plan_date — e.g. "move chicken from freezer to
// fridge" for a Friday dinner needs a Wednesday nudge.
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipePrepLeadDays } from '@/app/recipes/actions';
import { useToast } from '@/components/Toast';

type HebcalDay = { candleLighting?: string; isYomTov: boolean; titles: string[] };

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Next real candle-lighting on or after today -- any date with a
// candleLighting value, not just Friday, since Yom Tov eves can fall on
// other days too. Reuses /api/hebcal, the same endpoint already powering
// the Month view's flame icon, rather than a second lookup.
function useNextCandleLighting() {
  const [result, setResult] = useState<{ date: string; time: string; title: string } | null | undefined>(undefined);

  useEffect(() => {
    const today = new Date();
    const months: [number, number][] = [
      [today.getFullYear(), today.getMonth() + 1],
      [today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear(), (today.getMonth() + 1) % 12 + 1],
    ];
    Promise.all(
      months.map(([year, month]) =>
        fetch(`/api/hebcal?year=${year}&month=${month}`).then((r) => (r.ok ? r.json() : { days: {} }))
      )
    )
      .then((pages) => {
        const merged: Record<string, HebcalDay> = Object.assign({}, ...pages.map((p) => p.days ?? {}));
        const todayStr = fmt(today);
        const next = Object.entries(merged)
          .filter(([date, d]) => date >= todayStr && d.candleLighting)
          .sort(([a], [b]) => a.localeCompare(b))[0];
        setResult(
          next
            ? { date: next[0], time: next[1].candleLighting!, title: next[1].titles.join(', ') }
            : null
        );
      })
      .catch(() => setResult(null));
  }, []);

  return result;
}

export default function RecipePrepLeadDays({
  recipeId,
  initialDays,
}: {
  recipeId: string;
  initialDays: number | null;
}) {
  const [days, setDays] = useState(initialDays !== null ? String(initialDays) : '');
  const [saved, setSaved] = useState(initialDays !== null ? String(initialDays) : '');
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const t = useTranslations('recipeCards.prepLeadDays');
  const tc = useTranslations('common');
  const nextCandleLighting = useNextCandleLighting();

  const isDirty = days.trim() !== saved.trim();
  const savedDays = saved.trim() ? Number(saved.trim()) : null;

  let startByLabel: string | null = null;
  if (savedDays !== null && nextCandleLighting) {
    const target = new Date(nextCandleLighting.date + 'T12:00:00');
    target.setDate(target.getDate() - savedDays);
    startByLabel = target.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function handleSave() {
    startTransition(async () => {
      const parsed = days.trim() ? Number(days.trim()) : null;
      const result = await updateRecipePrepLeadDays({ recipeId, prepLeadDays: parsed });
      if (result.success) {
        setSaved(days.trim());
        showToast(t('savedToast'), { variant: 'success' });
      } else {
        showToast(result.error ?? t('errorToast'), { variant: 'error' });
      }
    });
  }

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:hidden">
      <h3 className="font-display text-lg text-denim mb-1">{t('title')}</h3>
      <p className="text-xs text-dusk mb-2">{t('description')}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={14}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          disabled={isPending}
          placeholder={t('placeholder')}
          className="w-24 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl px-3 py-2 text-sm text-denim disabled:opacity-60"
        />
        <span className="text-sm text-dusk">
          {days.trim() === '1' ? t('daysAheadSingular') : t('daysAheadPlural')}
        </span>
      </div>

      {savedDays !== null && (
        <p className="text-xs text-dusk mt-2">
          {nextCandleLighting === undefined
            ? t('loadingCandleLighting')
            : nextCandleLighting && startByLabel
              ? t('startByForCandleLighting', {
                  startBy: startByLabel,
                  candleDate: new Date(nextCandleLighting.date + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  }),
                  time: nextCandleLighting.time,
                })
              : t('noCandleLightingFound')}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button onClick={() => setDays(saved)} className="text-sm text-dusk hover:text-denim px-3 py-1.5">
            {tc('revert')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </div>
  );
}
