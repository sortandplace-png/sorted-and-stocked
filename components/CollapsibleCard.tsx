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
'use client'

import Link from 'next/link'
import Pin from '@/components/PinAccent'
import { useCardCollapse } from '@/lib/useCardCollapse'

export default function CollapsibleCard({
  cardId,
  href,
  pinSize = 'lg',
  className,
  header,
  children,
}: {
  cardId: string
  href?: string
  pinSize?: 'lg' | 'sm'
  className: string
  header: React.ReactNode
  children: React.ReactNode
}) {
  const { collapsed, toggle } = useCardCollapse(cardId)

  const inner = (
    <>
      <Pin size={pinSize} collapsed={collapsed} onToggle={toggle} />
      {header}
      <div
        className="flex-1 grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden flex flex-col flex-1 min-h-0">{children}</div>
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
