// components/CollapsibleCard.tsx
// Generic collapse/expand shell for the Dashboard's header-bar-plus-content
// cards (Today, Candle Lighting, Pantry, Meal Plan) -- those cards' data
// fetching and content JSX stay in the server component
// (app/properties/[id]/dashboard/page.tsx); only the collapse behavior
// itself needs a client boundary, so this wraps server-rendered `header`/
// `children` rather than owning any of that content.
//
// `href` is optional: pass it for the Pantry/Meal Plan cards (the whole
// card is a Link to begin with) and this renders a Link instead of a div.
// PinAccent's own stopPropagation keeps a tap on the dot from also
// triggering that Link's navigation.
//
// Split into a presentational Shell (collapsed/toggle as props) plus this
// self-contained default export (owns its own useCardCollapse call) so
// TodayCandleLightingRow.tsx can reuse the exact same shell with
// externally-coordinated state -- Today and Candle Lighting need to know
// about EACH OTHER's collapse state to decide whether to height-match,
// which a card managing its own isolated state can't do. Pantry/Meal Plan
// (and anything else using the default export below) are unaffected --
// same self-contained behavior as before.
'use client'

import Link from 'next/link'
import Pin from '@/components/PinAccent'
import { useCardCollapse } from '@/lib/useCardCollapse'

export function CollapsibleCardShell({
  collapsed,
  toggle,
  href,
  pinSize = 'lg',
  className,
  header,
  children,
}: {
  collapsed: boolean
  toggle: () => void
  href?: string
  pinSize?: 'lg' | 'sm'
  className: string
  header: React.ReactNode
  children: React.ReactNode
}) {
  // flex-1 on the animating wrapper is what makes it fill the remaining
  // height of this card's flex-col shell when expanded (matching what a
  // plain content div used to do before collapse existed) -- but applied
  // unconditionally, it fights grid-template-rows: 0fr directly: flex-grow
  // stretches the wrapper to fill available space in ITS flex parent
  // regardless of the grid row's own 0fr/1fr track size, so a collapsed
  // card kept its full height as an empty box even though the content
  // inside was correctly invisible. Only applying flex-1 when expanded is
  // what actually lets the collapsed state shrink.
  const inner = (
    <>
      <Pin size={pinSize} collapsed={collapsed} onToggle={toggle} />
      {header}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? '' : 'flex-1'}`}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden flex flex-col min-h-0">{children}</div>
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

export default function CollapsibleCard({
  cardId,
  ...rest
}: {
  cardId: string
  href?: string
  pinSize?: 'lg' | 'sm'
  className: string
  header: React.ReactNode
  children: React.ReactNode
}) {
  const { collapsed, toggle } = useCardCollapse(cardId)
  return <CollapsibleCardShell collapsed={collapsed} toggle={toggle} {...rest} />
}
