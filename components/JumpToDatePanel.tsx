// components/JumpToDatePanel.tsx
// "Jump to Date" for the Yom Tov Year View. Two tabs -- Gregorian and
// Hebrew -- each with a live conversion of the other calendar underneath.
//
// Every conversion goes through /api/hebcal/convert, which proxies Hebcal's
// converter endpoint. No hardcoded date maps: not the Gregorian equivalents,
// not the month lengths, not which years are leap years. The one thing
// computed locally is the Hebrew NUMERAL for a day (א׳, ט״ו), which is
// gematria formatting rather than calendar data.
//
// Why the month list is fetched per year rather than being a constant:
// 5787 is a leap year. It has thirteen months, with Adar I and Adar II in
// place of Adar -- verified against Hebcal, which resolves bare "Adar" to
// "Adar II" in that year. A fixed Tishrei-Elul list would be wrong for the
// exact year this page centers on. Month lengths move too: Cheshvan is 29
// days in 5786 and 30 in 5787, so a fixed 1-30 day dropdown would offer a
// day that does not exist.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Crosshair } from 'lucide-react';

type HebrewMonth = { name: string; hebrewName: string; days: number; startIso: string };

const GREG_YEARS = [2026, 2027, 2028];
const HEB_YEARS = [5786, 5787, 5788];

/** 1..30 as Hebrew numerals: 1 -> א׳, 15 -> ט״ו, 30 -> ל׳. */
export function hebrewNumeral(n: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל'];
  let letters: string;
  // 15 and 16 are written טו/טז, never יה/יו -- those spell divine names.
  if (n === 15) letters = 'טו';
  else if (n === 16) letters = 'טז';
  else letters = tens[Math.floor(n / 10)] + ones[n % 10];
  if (letters.length === 1) return `${letters}׳`; // geresh
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`; // gershayim
}

function daysInGregorianMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export default function JumpToDatePanel({
  cursor,
  onJump,
  onToday,
}: {
  cursor: Date;
  onJump: (iso: string) => void;
  onToday: () => void;
}) {
  const t = useTranslations('yomTovYearView');
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'gregorian' | 'hebrew'>('gregorian');

  // Gregorian selectors
  const [gy, setGy] = useState(cursor.getFullYear());
  const [gm, setGm] = useState(cursor.getMonth() + 1);
  const [gd, setGd] = useState(1);
  const [gPreview, setGPreview] = useState<string | null>(null);

  // Hebrew selectors
  const [hy, setHy] = useState(5787);
  const [hmName, setHmName] = useState('Tishrei');
  const [hd, setHd] = useState(1);
  const [months, setMonths] = useState<HebrewMonth[]>([]);
  const [hPreview, setHPreview] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  // Prev/next in the grid drives the selectors, so the panel always describes
  // the month actually on screen rather than whatever was last typed into it.
  useEffect(() => {
    setGy(cursor.getFullYear());
    setGm(cursor.getMonth() + 1);
  }, [cursor]);

  const currentMonth = useMemo(
    () => months.find((m) => m.name === hmName),
    [months, hmName]
  );

  // Month list per Hebrew year: leap-aware, with real day counts.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hebcal/convert?mode=months&hy=${hy}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.months) return;
        setMonths(d.months as HebrewMonth[]);
        // Adar I/II exist only in a leap year -- if the year changes out from
        // under a selected Adar I, fall back rather than hold a dead value.
        if (!d.months.some((m: HebrewMonth) => m.name === hmName)) setHmName('Tishrei');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hy]);

  // Clamp the day when the selected month is shorter than the current pick.
  useEffect(() => {
    if (currentMonth && hd > currentMonth.days) setHd(currentMonth.days);
  }, [currentMonth, hd]);

  useEffect(() => {
    const maxDay = daysInGregorianMonth(gy, gm);
    if (gd > maxDay) setGd(maxDay);
  }, [gy, gm, gd]);

  // Live conversion, Gregorian -> Hebrew.
  useEffect(() => {
    let cancelled = false;
    setGPreview(null);
    fetch(`/api/hebcal/convert?mode=g2h&gy=${gy}&gm=${gm}&gd=${gd}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.hebrew) return;
        setGPreview(`${d.hd} ${d.hm} ${d.hy} — ${d.hebrew}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gy, gm, gd]);

  // Live conversion, Hebrew -> Gregorian.
  useEffect(() => {
    let cancelled = false;
    setHPreview(null);
    fetch(
      `/api/hebcal/convert?mode=h2g&hy=${hy}&hm=${encodeURIComponent(hmName)}&hd=${hd}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.iso) return;
        setHPreview(
          new Date(`${d.iso}T00:00:00`).toLocaleDateString(locale, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hy, hmName, hd, locale]);

  const goGregorian = useCallback(() => {
    const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
    onJump(iso);
  }, [gy, gm, gd, onJump]);

  const goHebrew = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/hebcal/convert?mode=h2g&hy=${hy}&hm=${encodeURIComponent(hmName)}&hd=${hd}`
      );
      const d = res.ok ? await res.json() : null;
      if (d?.iso) onJump(d.iso);
    } finally {
      setBusy(false);
    }
  }, [hy, hmName, hd, onJump]);

  const field =
    'bg-card border border-cardBorder rounded-lg px-2.5 py-1.5 text-[13px] text-denim focus:border-brass focus:outline-none';
  const tabBase =
    'px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] rounded-full transition-colors';

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2026, i, 1).toLocaleDateString(locale, { month: 'long' })
      ),
    [locale]
  );

  return (
    <div className="mb-5">
      {/* The panel is collapsed by default -- the calendar itself is the
          point of the page, and a wall of six dropdowns above it would push
          the grid below the fold on a phone. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-dusk hover:text-denim transition-colors"
      >
        <Crosshair size={13} strokeWidth={1.75} aria-hidden="true" />
        {t('jumpToDate')}
      </button>

      {open && (
        <div className="mt-2.5 bg-card border border-cardBorder rounded-xl2 shadow-card p-4">
          <div className="flex items-center gap-1 bg-mist border border-cardBorder rounded-full p-1 w-fit mb-3.5">
            <button
              onClick={() => setTab('gregorian')}
              aria-pressed={tab === 'gregorian'}
              className={`${tabBase} ${tab === 'gregorian' ? 'bg-denim text-white' : 'text-dusk'}`}
            >
              {t('tabGregorian')}
            </button>
            <button
              onClick={() => setTab('hebrew')}
              aria-pressed={tab === 'hebrew'}
              className={`${tabBase} ${tab === 'hebrew' ? 'bg-denim text-white' : 'text-dusk'}`}
            >
              {t('tabHebrew')}
            </button>
          </div>

          {tab === 'gregorian' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={gm}
                  onChange={(e) => setGm(Number(e.target.value))}
                  aria-label={t('labelMonth')}
                  className={field}
                >
                  {monthLabels.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={gd}
                  onChange={(e) => setGd(Number(e.target.value))}
                  aria-label={t('labelDay')}
                  className={field}
                >
                  {Array.from({ length: daysInGregorianMonth(gy, gm) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={gy}
                  onChange={(e) => setGy(Number(e.target.value))}
                  aria-label={t('labelYear')}
                  className={field}
                >
                  {GREG_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={goGregorian}
                  className="px-4 py-1.5 rounded-full bg-denim text-white text-[13px] font-medium"
                >
                  {t('go')}
                </button>
              </div>
              <p className="text-[12px] text-dusk mt-2.5" dir="auto">
                {gPreview ?? t('converting')}
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={hmName}
                  onChange={(e) => setHmName(e.target.value)}
                  aria-label={t('labelHebrewMonth')}
                  className={field}
                >
                  {months.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} / {m.hebrewName}
                    </option>
                  ))}
                </select>
                <select
                  value={hd}
                  onChange={(e) => setHd(Number(e.target.value))}
                  aria-label={t('labelDay')}
                  className={field}
                >
                  {Array.from({ length: currentMonth?.days ?? 30 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {hebrewNumeral(d)} - {d}
                    </option>
                  ))}
                </select>
                <select
                  value={hy}
                  onChange={(e) => setHy(Number(e.target.value))}
                  aria-label={t('labelYear')}
                  className={field}
                >
                  {HEB_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={goHebrew}
                  disabled={busy}
                  className="px-4 py-1.5 rounded-full bg-denim text-white text-[13px] font-medium disabled:opacity-40"
                >
                  {t('go')}
                </button>
              </div>
              <p className="text-[12px] text-dusk mt-2.5" dir="auto">
                {hPreview ?? t('converting')}
              </p>
            </>
          )}

          <button
            onClick={onToday}
            className="mt-3 text-[12px] font-medium text-denim underline underline-offset-2"
          >
            {t('today')}
          </button>
        </div>
      )}
    </div>
  );
}
