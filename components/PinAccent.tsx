// components/PinAccent.tsx
// Recurring brass "pin" accent -- a small radial-gradient dot with a real
// box-shadow, appearing once per card across the dashboard (Today,
// Candle Lighting, Pantry, Meal Plan, action tiles, and now the widget
// cards). Extracted from app/properties/[id]/dashboard/page.tsx's local
// `Pin` component so both that file and DashboardWidgets.tsx render the
// exact same dot -- pure presentation, zero logic, nothing to diverge.
export default function Pin({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const dim = size === 'lg' ? 11 : 10
  const top = size === 'lg' ? 13 : 11
  const right = size === 'lg' ? 14 : 12
  return (
    <span
      className="absolute rounded-full pointer-events-none"
      style={{
        top,
        right,
        width: dim,
        height: dim,
        background: 'radial-gradient(circle at 36% 30%, #F8E8B8 0%, #C6A46E 52%, #7A4E18 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,.26), inset 0 .5px .5px rgba(255,255,255,.3)',
        zIndex: 2,
      }}
      aria-hidden="true"
    />
  )
}
