// components/PinAccent.tsx
// Recurring brass "pin" accent -- a small radial-gradient dot with a real
// box-shadow, appearing once per card across the dashboard (Today,
// Candle Lighting, Pantry, Meal Plan, action tiles, and the widget cards).
// Extracted from app/properties/[id]/dashboard/page.tsx's local `Pin`
// component so both that file and DashboardWidgets.tsx render the exact
// same dot -- pure presentation, zero logic, nothing to diverge.
//
import type { CSSProperties } from 'react'

// Doubles as the collapse/expand toggle for its card when `onToggle` is
// passed (2026-07-17): renders as a real <button> instead of a decorative
// <span> in that case, with stopPropagation so tapping the dot on a
// Link-wrapped card (Pantry, Meal Plan) toggles collapse instead of also
// navigating. Cards that don't pass onToggle keep the exact original
// non-interactive rendering -- no behavior change for those.
export default function Pin({
  size = 'lg',
  collapsed = false,
  onToggle,
}: {
  size?: 'lg' | 'sm'
  collapsed?: boolean
  onToggle?: () => void
}) {
  const dim = size === 'lg' ? 11 : 10
  const top = size === 'lg' ? 13 : 11
  const right = size === 'lg' ? 14 : 12
  const baseShadow = '0 1px 3px rgba(0,0,0,.26), inset 0 .5px .5px rgba(255,255,255,.3)'
  const style: CSSProperties = {
    top,
    right,
    width: dim,
    height: dim,
    background: 'radial-gradient(circle at 36% 30%, #F8E8B8 0%, #C6A46E 52%, #7A4E18 100%)',
    boxShadow: collapsed ? `${baseShadow}, 0 0 0 2px rgba(198,164,110,0.4)` : baseShadow,
    zIndex: 2,
  }

  if (!onToggle) {
    return <span className="absolute rounded-full pointer-events-none" style={style} aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="absolute rounded-full cursor-pointer"
      style={style}
      aria-label={collapsed ? 'Expand card' : 'Collapse card'}
      aria-expanded={!collapsed}
    />
  )
}
