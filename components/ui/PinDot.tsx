// components/ui/PinDot.tsx
//
// SUPERSEDED by components/ui/Pin.tsx (re-export of PinAccent). Kept, not
// deleted (R21). Do not use in new code: this dot is decorative only and has
// no size/collapsed/onToggle, so it cannot serve as a collapse control the
// way PinAccent does on 7 components.
// The brass pin dot that belongs on every card.
//
// Extracted because it was hand-rolled on each page that had one, which is why
// pages that came later simply didn't. Decorative only -- aria-hidden, no
// pointer events; real collapse controls live at the letter-group level (R10).
//
// NOTE: components/PinAccent.tsx already exports a <Pin> used in some places.
// This is the DutyRosterClient implementation (the 4/4 reference). The two
// should be reconciled onto one; that's a follow-up, not a silent swap.
export default function PinDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        top: 11,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 9999,
        background: 'radial-gradient(circle at 36% 30%, #F8E8B8 0%, #C6A46E 52%, #7A4E18 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,.26), inset 0 .5px .5px rgba(255,255,255,.3)',
      }}
    />
  );
}
