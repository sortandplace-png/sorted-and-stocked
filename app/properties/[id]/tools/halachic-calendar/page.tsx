// app/properties/[id]/tools/halachic-calendar/page.tsx
// Three small, related, pure-calculation features in one page rather than
// three near-empty ones: Sefiras HaOmer (only relevant ~7 weeks a year),
// an Erev Pesach countdown, and a static Bedikas Tolaim reference.
import { format } from 'date-fns'

const BEDIKAS_TOLAIM_ITEMS = [
  { item: 'Romaine lettuce', note: 'Check leaves individually against light, or use pre-checked bagged romaine.' },
  { item: 'Broccoli & cauliflower', note: 'Soak in soapy water, separate florets, check crevices carefully.' },
  { item: 'Strawberries & berries', note: 'Rinse well and inspect — hollow/soft spots often hide insects.' },
  { item: 'Asparagus', note: 'Check under the tips/scales near the head.' },
  { item: 'Brussels sprouts', note: 'Peel back outer leaves and check between layers.' },
  { item: 'Herbs (parsley, dill, cilantro)', note: 'Rinse and inspect stems closely — a common source of overlooked bugs.' },
  { item: 'Corn on the cob', note: 'Check silk and tip carefully before cooking.' },
]

async function getOmerStatus() {
  try {
    const now = new Date()
    const res = await fetch(
      `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${now.getFullYear()}&month=${now.getMonth() + 1}&o=on`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const today = format(now, 'yyyy-MM-dd')
    const omerItem = data.items?.find((i: any) => i.category === 'omer' && i.date?.startsWith(today))
    return omerItem?.title ?? null
  } catch {
    return null
  }
}

async function getNextErevPesach() {
  try {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    const events: { title: string; date: string }[] = []
    for (const year of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&maj=on`, {
        next: { revalidate: 3600 * 24 },
      })
      const data = await res.json()
      events.push(...(data.items ?? []))
    }
    const todayStr = format(now, 'yyyy-MM-dd')
    const candidates = events
      .filter((e) => e.title?.includes('Erev Pesach') && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
    return candidates[0] ?? null
  } catch {
    return null
  }
}

export default async function HalachicCalendarPage() {
  const [omerTitle, erevPesach] = await Promise.all([getOmerStatus(), getNextErevPesach()])

  const daysUntilPesach = erevPesach
    ? Math.round((new Date(erevPesach.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Halachic Calendar</h1>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-1">Sefiras HaOmer</h2>
        {omerTitle ? (
          <p className="text-sm text-charcoal">Tonight/today: {omerTitle}</p>
        ) : (
          <p className="text-sm text-charcoal/50">Not currently within the Omer count.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-1">Erev Pesach Countdown</h2>
        {erevPesach && daysUntilPesach !== null ? (
          <p className="text-sm text-charcoal">
            {daysUntilPesach === 0
              ? 'Erev Pesach is today.'
              : `${daysUntilPesach} day${daysUntilPesach === 1 ? '' : 's'} until Erev Pesach (${new Date(
                  erevPesach.date
                ).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}).`}
          </p>
        ) : (
          <p className="text-sm text-charcoal/50">Couldn't load the date right now.</p>
        )}
        <p className="text-xs text-charcoal/40 mt-1">
          Date only, not halachic times — Hebcal doesn't expose sof zman achilas/biur chametz through this API.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-2">Bedikas Tolaim Reference</h2>
        <ul className="space-y-2">
          {BEDIKAS_TOLAIM_ITEMS.map((entry) => (
            <li key={entry.item}>
              <p className="text-sm font-medium text-charcoal">{entry.item}</p>
              <p className="text-xs text-charcoal/60">{entry.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
