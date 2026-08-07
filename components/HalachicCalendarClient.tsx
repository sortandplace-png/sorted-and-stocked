// components/HalachicCalendarClient.tsx
// Client-refactor of the old server-component page (app/properties/[id]/
// tools/halachic-calendar/page.tsx, now removed) so it can run inside
// ToolModal like the rest of the Household group. The Hebcal fetch logic
// itself is unchanged, just moved server-side into /api/tools/halachic-calendar
// so it can keep Next's fetch cache.
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { SkeletonList } from '@/components/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { getEasternDateStr } from '@/lib/eastern-weekday';
import { groupYomTovOccasions, type YomTovOccasion } from '@/lib/yom-tov';
import Pin from '@/components/PinAccent';
import { CardHeader } from '@/components/ShiftHandoverClient';

// Concept B card shell -- rounded-xl3/border-cardBorder/shadow-card/PinAccent
// sm/denim header strip, matching the pattern already live on StaffClient's
// bento cards and SquarePaymentCard. Local to this file since every card
// here needs the identical wrapper and there's no third consumer yet to
// justify a shared component.
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" />
      <CardHeader>{title}</CardHeader>
      <div className="p-4">{children}</div>
    </div>
  );
}

const BEDIKAS_TOLAIM_ITEMS = [
  { item: 'Romaine lettuce', note: 'Check leaves individually against light, or use pre-checked bagged romaine.' },
  { item: 'Broccoli & cauliflower', note: 'Soak in soapy water, separate florets, check crevices carefully.' },
  { item: 'Strawberries & berries', note: 'Rinse well and inspect — hollow/soft spots often hide insects.' },
  { item: 'Asparagus', note: 'Check under the tips/scales near the head.' },
  { item: 'Brussels sprouts', note: 'Peel back outer leaves and check between layers.' },
  { item: 'Herbs (parsley, dill, cilantro)', note: 'Rinse and inspect stems closely — a common source of overlooked bugs.' },
  { item: 'Corn on the cob', note: 'Check silk and tip carefully before cooking.' },
];

type RoshChodeshStatus = {
  isToday: boolean;
  monthName: string;
  hebrewName: string;
  daysUntil: number;
  days: { date: string; hdate: string }[];
} | null;

type OmerOutlook =
  | { state: 'inside'; day: number; countText: string; hdate: string; date: string }
  | { state: 'before'; nightOfDate: string; firstDayDate: string; firstDayHdate: string }
  | null;

type CalendarData = {
  omerTitle: string | null;
  omerOutlook: OmerOutlook;
  erevPesach: { title: string; date: string } | null;
  daysUntilPesach: number | null;
  roshChodeshStatus: RoshChodeshStatus;
};

export default function HalachicCalendarClient() {
  const tHalachaCal = useTranslations('halachicDisclaimer');
  const t = useTranslations('halachicCalendar');
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<YomTovOccasion[] | null>(null);

  useEffect(() => {
    fetch('/api/tools/halachic-calendar')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));

    // SS-479. yom_tov_dates is superseded (migration 220) -- computed via
    // jewish_calendar_dates now, same source as the Dashboard card. The
    // RPC needs both bounds; one year out always contains the next 3
    // occasions. Rosh Chodesh/Chanukah/Purim excluded -- this list means
    // Yom Tov specifically, and Rosh Chodesh status already has its own,
    // separate Hebcal-backed answer from /api/tools/halachic-calendar
    // above, so it is not missing here, just not duplicated.
    const supabase = createClient();
    // SS-208. Was format(new Date(), 'yyyy-MM-dd') -- date-fns with no
    // timeZone reads the JS runtime's own zone (UTC on Vercel), so from
    // roughly 8pm Eastern this excluded/included occasions a day off.
    const todayStr = getEasternDateStr(new Date());
    const oneYearOut = new Date(`${todayStr}T00:00:00Z`);
    oneYearOut.setUTCFullYear(oneYearOut.getUTCFullYear() + 1);
    supabase
      .rpc('jewish_calendar_dates', { p_from: todayStr, p_to: oneYearOut.toISOString().slice(0, 10) })
      .not('holiday_name', 'like', 'Rosh Chodesh%')
      .not('holiday_name', 'like', 'Chanukah%')
      .not('holiday_name', 'ilike', '%purim%')
      .order('date')
      .then(({ data: rows }) => {
        setUpcoming(groupYomTovOccasions(rows || [], todayStr).slice(0, 3));
      });
  }, []);

  if (loading) return <SkeletonList rows={3} />;

  const { omerOutlook, erevPesach, daysUntilPesach, roshChodeshStatus } = data ?? {
    omerOutlook: null,
    erevPesach: null,
    daysUntilPesach: null,
    roshChodeshStatus: null,
  };

  return (
    <div className="bg-mist p-4 space-y-4">
      <h1 className="text-2xl font-display text-denim mb-1">Halachic Calendar</h1>
      {/* SS-621, approved by Racquel with her Rav. Wording is FINAL -- do
          not paraphrase, shorten or "improve" it. Zmanim here are computed
          from a zip code, which is not the same as the shul's published
          times, and that difference matters most on exactly this page. */}
      <p className="text-[12px] leading-relaxed text-dusk">{tHalachaCal('times')}</p>

      {upcoming && upcoming.length > 0 && (
        <Card title="Upcoming">
          <ul className="space-y-1.5">
            {upcoming.map((occ) => (
              <li key={occ.name + occ.date} className="flex items-center justify-between text-sm">
                <span className="font-medium text-denim">{occ.name}</span>
                <span className="text-dusk">
                  {format(parseISO(occ.date), 'MMM d')} · {occ.daysUntil === 0 ? 'today' : `${occ.daysUntil} day${occ.daysUntil === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Answers "where are we in the count", never reports absence. Outside
          the count it shows when counting next begins, with BOTH the night
          and the first civil day -- the spec originally named Erev Pesach
          (21 Apr 2027) as the start, when Hebcal's day 1 is 23 Apr and the
          counting night is the 22nd. Showing one date alone is what makes
          that ambiguous. Both come from Hebcal; neither is derived here. */}
      <Card title={t('omerTitle')}>
        {omerOutlook?.state === 'inside' ? (
          <>
            <p className="text-sm font-medium text-denim">{t('omerDay', { day: omerOutlook.day })}</p>
            <p className="text-sm text-denim mt-0.5">{omerOutlook.countText}</p>
            {omerOutlook.hdate && <p className="text-xs text-dusk mt-1">{omerOutlook.hdate}</p>}
          </>
        ) : omerOutlook?.state === 'before' ? (
          <>
            <p className="text-sm text-denim">
              {t('omerBeginsNightOf', { date: format(parseISO(omerOutlook.nightOfDate), 'd MMMM yyyy') })}
            </p>
            <p className="text-xs text-dusk mt-1">
              {t('omerFirstDay', {
                hdate: omerOutlook.firstDayHdate,
                date: format(parseISO(omerOutlook.firstDayDate), 'EEEE d MMMM'),
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-dusk">{t('omerUnavailable')}</p>
        )}
      </Card>

      {/* Always shows the next Rosh Chodesh, however far out -- the old
          5-day lookahead found it correctly and then discarded it, which is
          why this card used to report absence. Two-day Rosh Chodesh renders
          both days; Hebrew month name, Hebrew date and civil date all come
          straight from Hebcal's title/hebrew/hdate fields. */}
      <Card title={t('roshChodeshTitle')}>
        {roshChodeshStatus ? (
          <>
            <p className={roshChodeshStatus.isToday ? 'text-base font-semibold text-denim' : 'text-sm font-medium text-denim'}>
              {roshChodeshStatus.isToday
                ? t('roshChodeshToday', { month: roshChodeshStatus.monthName })
                : t('roshChodeshNext', { month: roshChodeshStatus.monthName })}
              {roshChodeshStatus.hebrewName && (
                <span className="text-dusk font-normal"> · {roshChodeshStatus.hebrewName}</span>
              )}
            </p>
            <ul className="mt-1 space-y-0.5">
              {roshChodeshStatus.days.map((d) => (
                <li key={d.date} className="text-sm text-denim">
                  {format(parseISO(d.date), 'EEEE d MMMM')}
                  {d.hdate && <span className="text-dusk"> ({d.hdate})</span>}
                </li>
              ))}
            </ul>
            {!roshChodeshStatus.isToday && (
              <p className="text-xs text-brass mt-1">
                {t('inDays', { count: roshChodeshStatus.daysUntil })}
              </p>
            )}
            {roshChodeshStatus.days.length > 1 && (
              <p className="text-xs text-dusk mt-1">{t('twoDay')}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-dusk">{t('roshChodeshUnavailable')}</p>
        )}
      </Card>

      <Card title="Erev Pesach Countdown">
        {erevPesach && daysUntilPesach !== null ? (
          <p className="text-sm text-denim">
            {daysUntilPesach === 0
              ? 'Erev Pesach is today.'
              : `${daysUntilPesach} day${daysUntilPesach === 1 ? '' : 's'} until Erev Pesach (${new Date(
                  erevPesach.date
                ).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}).`}
          </p>
        ) : (
          <p className="text-sm text-dusk">Couldn't load the date right now.</p>
        )}
        <p className="text-xs text-dusk mt-1">
          Date only, not halachic times — Hebcal doesn't expose sof zman achilas/biur chametz through this API.
        </p>
      </Card>

      <Card title="Bedikas Tolaim Reference">
        <ul className="space-y-2">
          {BEDIKAS_TOLAIM_ITEMS.map((entry) => (
            <li key={entry.item}>
              <p className="text-sm font-medium text-denim">{entry.item}</p>
              <p className="text-xs text-dusk">{entry.note}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
