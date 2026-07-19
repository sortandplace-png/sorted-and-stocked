// components/TodayCandleLightingRow.tsx
// Today and Candle Lighting need to know about EACH OTHER's collapse state
// to decide whether to height-match -- a card managing its own isolated
// collapse state (the default CollapsibleCard export) can't do that, so
// this owns both useCardCollapse calls itself and renders both cards via
// the shared CollapsibleCardShell with externally-supplied state.
//
// Approved design: both expanded -> stretch (auto-match each other's
// height, the original pre-collapse-feature behavior); either collapsed ->
// start (each sizes to its own content, no forced stretch -- this is what
// the collapse-container-shrink fix needed and must keep working). Scoped
// to just this one row via its own nested grid-cols-12, rather than
// touching the outer page grid's own items-start -- Pantry/Meal Plan (and
// anything else sharing that outer grid) stay on the simple
// self-contained CollapsibleCard, unaffected.
'use client'

import { CollapsibleCardShell } from '@/components/CollapsibleCard'
import { useCardCollapse } from '@/lib/useCardCollapse'

export default function TodayCandleLightingRow({
  todayHeader,
  todayContent,
  candleHeader,
  candleContent,
}: {
  todayHeader: React.ReactNode
  todayContent: React.ReactNode
  candleHeader: React.ReactNode
  candleContent: React.ReactNode
}) {
  const today = useCardCollapse('today')
  const candle = useCardCollapse('candle-lighting')
  const bothExpanded = !today.collapsed && !candle.collapsed

  return (
    <div className={`col-span-12 grid grid-cols-12 gap-[14px] ${bothExpanded ? 'items-stretch' : 'items-start'}`}>
      <CollapsibleCardShell
        collapsed={today.collapsed}
        toggle={today.toggle}
        className="relative col-span-12 md:col-span-7 rounded-xl3 border border-cardBorder shadow-card overflow-hidden flex flex-col transition-shadow hover:shadow-cardHover"
        header={todayHeader}
      >
        {todayContent}
      </CollapsibleCardShell>
      <CollapsibleCardShell
        collapsed={candle.collapsed}
        toggle={candle.toggle}
        className="col-span-12 md:col-span-5 rounded-xl3 border border-cardBorder shadow-card overflow-hidden relative flex flex-col transition-shadow hover:shadow-cardHover"
        header={candleHeader}
      >
        {candleContent}
      </CollapsibleCardShell>
    </div>
  )
}
