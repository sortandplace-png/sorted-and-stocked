// GET /api/tools/halachic-calendar
//
// Server-side so the Hebcal calls can use Next's fetch cache (moved here
// unchanged from the old halachic-calendar/page.tsx server component as
// part of the client-refactor into ToolModal).
import { NextResponse } from 'next/server';
import { getOmerStatus, getRoshChodeshStatus } from '@/lib/calendar-trigger-type';

// Same Eastern-anchoring pattern the Dashboard page uses (app/properties/
// [id]/dashboard/page.tsx's own local easternDateStr) -- kept local here
// rather than exported from calendar-trigger-type.ts, matching that file's
// existing private easternDateParts() and the Dashboard's own precedent of
// a small local copy per caller rather than a shared cross-file utility.
function easternDateStr(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

// todayStr must already be Eastern-anchored (easternDateStr), not raw
// server/UTC time -- both the year range and the >= todayStr filter need
// "today" to mean the same calendar day a person in Eastern time sees.
async function getNextErevPesach(todayStr: string) {
  try {
    const year = Number(todayStr.slice(0, 4));
    const years = [year, year + 1];
    const events: { title: string; date: string }[] = [];
    for (const y of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${y}&maj=on`, {
        next: { revalidate: 3600 * 24 },
      });
      const data = await res.json();
      events.push(...(data.items ?? []));
    }
    const candidates = events
      .filter((e) => e.title?.includes('Erev Pesach') && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const todayStr = easternDateStr(new Date());
  const [omerTitle, erevPesach, roshChodeshStatus] = await Promise.all([
    getOmerStatus(),
    getNextErevPesach(todayStr),
    getRoshChodeshStatus(todayStr),
  ]);

  // Both sides are 'yyyy-MM-dd' calendar dates (todayStr already
  // Eastern-anchored, erevPesach.date from Hebcal), so parsing each as a
  // UTC-midnight instant and diffing gives an exact day count -- unlike
  // diffing against Date.now(), which pulls in the current time-of-day and
  // rounds inconsistently depending on when in the day it runs.
  const daysUntilPesach = erevPesach
    ? Math.round((Date.parse(erevPesach.date) - Date.parse(todayStr)) / (1000 * 60 * 60 * 24))
    : null;

  return NextResponse.json({ omerTitle, erevPesach, daysUntilPesach, roshChodeshStatus });
}
