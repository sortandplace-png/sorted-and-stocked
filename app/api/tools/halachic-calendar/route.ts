// GET /api/tools/halachic-calendar
//
// Server-side so the Hebcal calls can use Next's fetch cache (moved here
// unchanged from the old halachic-calendar/page.tsx server component as
// part of the client-refactor into ToolModal).
import { NextResponse } from 'next/server';
import { format } from 'date-fns';

async function getOmerStatus() {
  try {
    const now = new Date();
    const res = await fetch(
      `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${now.getFullYear()}&month=${now.getMonth() + 1}&o=on`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const today = format(now, 'yyyy-MM-dd');
    const omerItem = data.items?.find((i: any) => i.category === 'omer' && i.date?.startsWith(today));
    return omerItem?.title ?? null;
  } catch {
    return null;
  }
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
  const [omerTitle, erevPesach] = await Promise.all([getOmerStatus(), getNextErevPesach()]);

  const daysUntilPesach = erevPesach
    ? Math.round((new Date(erevPesach.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return NextResponse.json({ omerTitle, erevPesach, daysUntilPesach });
}
