// GET /api/tools/halachic-calendar
//
// Server-side so the Hebcal calls can use Next's fetch cache (moved here
// unchanged from the old halachic-calendar/page.tsx server component as
// part of the client-refactor into ToolModal).
import { NextResponse } from 'next/server';
import { format } from 'date-fns';
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

async function getNextErevPesach() {
  try {
    const now = new Date();
    const years = [now.getFullYear(), now.getFullYear() + 1];
    const events: { title: string; date: string }[] = [];
    for (const year of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&maj=on`, {
        next: { revalidate: 3600 * 24 },
      });
      const data = await res.json();
      events.push(...(data.items ?? []));
    }
    const todayStr = format(now, 'yyyy-MM-dd');
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
    getNextErevPesach(),
    getRoshChodeshStatus(todayStr),
  ]);

  const daysUntilPesach = erevPesach
    ? Math.round((new Date(erevPesach.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return NextResponse.json({ omerTitle, erevPesach, daysUntilPesach, roshChodeshStatus });
}
