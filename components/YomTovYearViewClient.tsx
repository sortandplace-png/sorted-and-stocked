// components/YomTovYearViewClient.tsx
// Yom Tov Year View. Replaces the plain white scrolling <ul> this page
// shipped with -- tiles in a grid, same rhythm as the Task Center's room
// tiles, plus a month-grid alternative.
//
// The three visual tiers come from classifyObservance in lib/yom-tov.ts, not
// from a column: yom_tov_dates has no type field and no fast days in it at
// all. The page merges fast_days in, which is where the rust tier comes from.
//
// D-01: brass is the pin dot, never a fill or a border. The left border that
// carries the tier is denim / dusk / rust.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Pin from '@/components/ui/Pin';
import JumpToDatePanel from '@/components/JumpToDatePanel';
import { isSecondDay } from '@/lib/yom-tov';
import type { ObservanceKind } from '@/lib/yom-tov';
import { usFederalHolidays, type UsHoliday } from '@/lib/us-holidays';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';

export type Observance = {
  date: string;
  name_en: string;
  name_es: string | null;
  kind: ObservanceKind;
};

type View = 'list' | 'calendar';

const VIEW_KEY = 'yomTovYearView.view';

// Tier styling, written as literal class strings -- Tailwind cannot see
// dynamically built ones. bg + left border per the spec; the past-date
// treatment is opacity on top, so a past Chol Hamoed still reads as Chol
// Hamoed rather than collapsing into one grey.
const TIER: Record<ObservanceKind, string> = {
  yomTov: 'bg-card border-l-4 border-l-denim',
  intermediate: 'bg-mist border-l-4 border-l-dusk',
  fast: 'bg-card border-l-4 border-l-rust/70',
};

// The same three tiers as a dot on a calendar cell, where there is no room
// for a left border.
const DOT: Record<ObservanceKind, string> = {
  yomTov: 'bg-denim',
  intermediate: 'bg-dusk',
  fast: 'bg-rust/70',
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Days of the month containing `cursor`, padded to whole weeks (Sun-start). */
function monthMatrix(cursor: Date): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Local-date ISO. Not toISOString(), which shifts to UTC and can land on
 *  the previous day for anyone west of Greenwich -- this page is entirely
 *  about which calendar day something falls on. */
function localIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function YomTovYearViewClient({
  propertyId,
  observances,
  // SS-469 calendar layers (properties.calendar_layers): 'jewish' gates
  // Shabbos/candles/observances, 'civil' gates the US federal holidays.
  // Defaults keep every existing mount rendering exactly as before.
  calendarLayers = ['jewish', 'civil'],
  zip = null,
}: {
  propertyId: string;
  observances: Observance[];
  calendarLayers?: string[];
  zip?: string | null;
}) {
  const t = useTranslations('yomTovYearView');
  const locale = useLocale();
  const es = locale === 'es';

  const [view, setView] = useState<View>('list');
  const today = localIso(new Date());

  const name = (o: Observance) => (es && o.name_es ? o.name_es : o.name_en);

  // Read in an effect rather than a useState initializer: sessionStorage does
  // not exist during the server render, and seeding state from it directly
  // would hydrate-mismatch. LIST is the default, so the first paint is
  // correct for everyone and only a returning CALENDAR user sees a switch.
  useEffect(() => {
    const saved = sessionStorage.getItem(VIEW_KEY);
    if (saved === 'calendar' || saved === 'list') setView(saved);
  }, []);

  function chooseView(next: View) {
    setView(next);
    sessionStorage.setItem(VIEW_KEY, next);
  }

  // Opens on the current month, empty grid and all. It used to jump to the
  // month of the next observance, which meant the calendar opened somewhere
  // other than where the reader is -- "where am I" beats "where is the next
  // busy month", and Jump to Date already covers getting elsewhere.
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // The list is a "what's coming" surface, so a date that has passed drops
  // off it entirely rather than sitting at the top greyed out -- it used to
  // open on March 2026, months behind the reader. The CALENDAR keeps every
  // date, including past ones: a month grid with holes where history should
  // be would just look broken.
  const upcoming = useMemo(
    () => observances.filter((o) => o.date >= today),
    [observances, today]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Observance[]>();
    for (const o of observances) {
      const list = map.get(o.date) ?? [];
      list.push(o);
      map.set(o.date, list);
    }
    return map;
  }, [observances]);

  const cells = useMemo(() => monthMatrix(cursor), [cursor]);

  const showJewish = calendarLayers.includes('jewish');
  const showCivil = calendarLayers.includes('civil');

  // SS-467: US federal holidays are pure date rules -- computed for the
  // cursor month's year, no API, no table, never expires.
  const civilByDate = useMemo(() => {
    if (!showCivil) return new Map<string, UsHoliday>();
    return new Map(usFederalHolidays(cursor.getFullYear()).map((h) => [h.date, h]));
  }, [cursor, showCivil]);

  // SS-465/SS-466: candle lighting, havdalah and Rosh Chodesh for the
  // cursor month, computed from Hebcal keyed to the property's zip (R1).
  const [monthTimes, setMonthTimes] = useState<Map<string, { candles?: string; havdalah?: string }>>(new Map());
  const [roshChodeshDates, setRoshChodeshDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!showJewish) return;
    let cancelled = false;
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    fetch(`/api/hebcal/month?gy=${y}&gm=${m}${zip ? `&zip=${zip}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const map = new Map<string, { candles?: string; havdalah?: string }>();
        for (const t of d.times ?? []) {
          const entry = map.get(t.date) ?? {};
          if (t.category === 'candles') entry.candles = t.time;
          else entry.havdalah = t.time;
          map.set(t.date, entry);
        }
        setMonthTimes(map);
        setRoshChodeshDates(new Set((d.roshChodesh ?? []).map((r: { date: string }) => r.date)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cursor, zip, showJewish]);

  // Jump-to-date highlight. Cleared on a timer rather than left on, so the
  // ring marks the day you asked for and then gets out of the way.
  const [highlightIso, setHighlightIso] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightIso) return;
    const id = setTimeout(() => setHighlightIso(null), 2000);
    return () => clearTimeout(id);
  }, [highlightIso]);

  const jumpTo = useCallback((iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setHighlightIso(iso);
    // Jumping to a date only means something on the grid, so this switches
    // views rather than silently moving a calendar the reader cannot see.
    setView('calendar');
    sessionStorage.setItem(VIEW_KEY, 'calendar');
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setHighlightIso(localIso(now));
  }, []);

  // The Hebrew half of the dual month header. Taken from the 15th rather
  // than the 1st: a Hebrew month straddles two Gregorian ones, and mid-month
  // is the one that actually covers most of what is on screen.
  const [hebrewLabel, setHebrewLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    fetch(`/api/hebcal/convert?mode=g2h&gy=${y}&gm=${m}&gd=15`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.heParts) return;
        setHebrewLabel(`${d.heParts.m} ${d.heParts.y}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cursor]);

  const weekdayLabels = useMemo(() => {
    // Derived from the locale rather than seven more translation keys --
    // a Sunday-start week starting from a known Sunday.
    const base = new Date(2024, 8, 1); // 2024-09-01 is a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  function longDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  const toggleBase =
    'px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] rounded-full transition-colors';

  return (
    <div className="max-w-[1240px] mx-auto p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
          <p className="text-sm text-dusk">{t('subtitle')}</p>
        </div>

        {/* D-18: the selected side is bg-denim + white, not a brass fill. */}
        <div
          role="group"
          aria-label={t('viewToggleLabel')}
          className="flex items-center gap-1 bg-mist border border-cardBorder rounded-full p-1"
        >
          <button
            onClick={() => chooseView('list')}
            aria-pressed={view === 'list'}
            className={`${toggleBase} ${view === 'list' ? 'bg-denim text-white' : 'text-dusk'}`}
          >
            {t('viewList')}
          </button>
          <button
            onClick={() => chooseView('calendar')}
            aria-pressed={view === 'calendar'}
            className={`${toggleBase} ${view === 'calendar' ? 'bg-denim text-white' : 'text-dusk'}`}
          >
            {t('viewCalendar')}
          </button>
        </div>
      </div>

      <JumpToDatePanel cursor={cursor} onJump={jumpTo} onToday={goToday} />

      {/* SS-469: the CALENDAR renders even with zero observances -- a
          civil-only house (Henderson) has no jewish rows by design, and
          August is genuinely empty of yom tov; the grid still has
          Saturdays, candle times and US holidays to show. Only the LIST
          view keeps the empty state. */}
      {observances.length === 0 && view === 'list' ? (
        <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
          {t('empty')}
        </p>
      ) : view === 'calendar' ? (
        <div className="bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
          <div className="bg-denim py-[11px] px-5 flex items-center justify-between gap-3">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label={t('prevMonth')}
              className="text-white/80 hover:text-white"
            >
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            {/* Dual format. The Hebrew half is omitted rather than faked
                while the conversion is in flight -- a wrong Hebrew month is
                worse than a missing one on this page. */}
            <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white text-center">
              {monthLabel}
              {hebrewLabel && <span className="text-white/70"> / {hebrewLabel}</span>}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label={t('nextMonth')}
              className="text-white/80 hover:text-white"
            >
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {weekdayLabels.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dusk text-center py-1"
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`pad-${i}`} className="min-h-[86px] rounded-lg" />;
                const iso = localIso(d);
                const items = showJewish ? byDate.get(iso) ?? [] : [];
                const isToday = iso === today;
                const isSaturday = d.getDay() === 6;
                const civil = civilByDate.get(iso);
                const times = showJewish ? monthTimes.get(iso) : undefined;
                const isRoshChodesh = showJewish && roshChodeshDates.has(iso);
                // R2: a fast day reads blacked-out on the GRID (meals on
                // erev/motzei stay fully plannable elsewhere -- this is a
                // rendering treatment, not a data rule).
                const isFast = items.some((o) => o.kind === 'fast');
                return (
                  <div
                    key={iso}
                    className={`min-h-[86px] rounded-lg border p-1.5 ${
                      isFast
                        ? 'border-rust/50 bg-rust/[0.07]'
                        : isToday
                          ? 'border-denim bg-mist'
                          : isSaturday && showJewish
                            ? 'border-brass/40 bg-linen'
                            : 'border-cardBorder bg-card'
                    } ${
                      iso === highlightIso
                        ? 'ring-2 ring-denim ring-offset-1 animate-pulse'
                        : ''
                    }`}
                  >
                    <span
                      className={`block text-[11px] tabular-nums mb-1 ${
                        isToday ? 'font-semibold text-denim' : 'text-dusk'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {/* SS-465: every Saturday IS Shabbos -- computed, never
                        seeded (a Saturday is a fact of the weekday grid;
                        the times below are the Hebcal-computed part). */}
                    {isSaturday && showJewish && (
                      <span className="block text-[10px] font-medium text-denim leading-tight mb-0.5">
                        {es ? 'Shabat' : 'Shabbos'}
                        {times?.havdalah && (
                          <span className="block text-[9px] text-dusk tabular-nums">★ {times.havdalah}</span>
                        )}
                      </span>
                    )}
                    {/* SS-466: candle lighting on the Friday square, keyed
                        to this property's zip. Erev Yom Tov candles come
                        through the same feed on their own dates. */}
                    {times?.candles && (
                      <span className="flex items-center gap-0.5 text-[9px] text-dusk tabular-nums mb-0.5">
                        <Flame size={9} strokeWidth={1.75} className="text-brass shrink-0" aria-hidden="true" />
                        {times.candles}
                      </span>
                    )}
                    {isRoshChodesh && (
                      <span className="block text-[9px] text-dusk leading-tight mb-0.5">
                        {es ? 'Rosh Jodesh' : 'Rosh Chodesh'}
                      </span>
                    )}
                    {civil && (
                      <span className="block text-[10px] text-denim/70 leading-tight mb-0.5" title={es ? civil.name_es : civil.name_en}>
                        {es ? civil.name_es : civil.name_en}
                      </span>
                    )}
                    {items.map((o) => (
                      <span
                        key={`${o.date}-${o.name_en}`}
                        className="flex items-start gap-1 mb-0.5"
                        title={name(o)}
                      >
                        {/* Same tier colour, smaller on day two (6px vs
                            8px) -- the distinction is size, not colour, so
                            the tier stays readable at a glance. */}
                        <span
                          className={`mt-[5px] rounded-full shrink-0 ${DOT[o.kind]} ${
                            isSecondDay(o.name_en) ? 'w-1.5 h-1.5' : 'w-2 h-2'
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`text-[10px] leading-tight ${
                            o.kind === 'yomTov'
                              ? 'text-denim font-medium'
                              : o.kind === 'fast'
                                ? 'text-rust'
                                : 'text-dusk'
                          }`}
                        >
                          {name(o)}
                        </span>
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Tiles, not a list. Grouped by month so a year of dates has some
        // structure to it rather than 30 tiles running together.
        <div className="space-y-6">
          {/* Distinct from "no dates at all": the table has rows, they are
              simply all behind us. Says so rather than rendering blank. */}
          {upcoming.length === 0 && (
            <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
              {t('emptyUpcoming')}
            </p>
          )}
          {[...new Set(upcoming.map((o) => monthKey(o.date)))].map((mk) => {
            const items = upcoming.filter((o) => monthKey(o.date) === mk);
            const label = new Date(`${mk}-01T00:00:00`).toLocaleDateString(locale, {
              month: 'long',
              year: 'numeric',
            });
            return (
              <div key={mk}>
                <div className="relative bg-denim rounded-xl2 py-[11px] pl-5 pr-8 mb-[14px] flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white truncate">
                    {label}
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 shrink-0">
                    {items.length}
                  </span>
                  <Pin size="sm" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[14px]">
                  {items.map((o) => {
                    // SS-078. Day two is lighter and carries a badge WHERE
                    // THE PIN WOULD BE -- the badge replaces the pin rather
                    // than joining it, so the corner says one thing. Lighter
                    // only: day two is fully plannable, not disabled.
                    const second = isSecondDay(o.name_en);
                    return (
                      <div
                        key={`${o.date}-${o.name_en}`}
                        className={`relative rounded-xl2 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow py-[14px] pl-[18px] pr-8 ${
                          TIER[o.kind]
                        } ${second ? 'opacity-70' : ''}`}
                      >
                        {second ? (
                          <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-dusk border border-cardBorder rounded-full px-1.5 py-0.5 bg-card/80">
                            {t('dayTwo')}
                          </span>
                        ) : (
                          <Pin size="sm" />
                        )}
                        <span className="block font-display text-[19px] text-denim leading-snug">
                          {name(o)}
                        </span>
                        <span className="block text-[13px] text-dusk mt-1">{longDate(o.date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
