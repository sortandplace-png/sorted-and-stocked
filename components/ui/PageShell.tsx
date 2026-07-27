// components/ui/PageShell.tsx
// Large card with the optional denim strip header -- the single most-missed
// marker in the audit (most 2/4 and 3/4 pages are missing exactly this).
//
// `strip` is the uppercase summary line, e.g. "10 QUESTIONS · SHIFT ORDER".
// Pass an already-translated string; this component holds no copy of its own
// so it never becomes a place English hides (R19).
import PinDot from '@/components/ui/PinDot';

export default function PageShell({
  strip,
  stripRight,
  children,
  className = '',
}: {
  strip?: string;
  stripRight?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative bg-card border border-cardBorder rounded-xl3 shadow-card overflow-hidden ${className}`}>
      <PinDot />
      {strip && (
        <div className="bg-denim py-[11px] px-5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white">{strip}</span>
          {stripRight && (
            <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 hidden sm:block">
              {stripRight}
            </span>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
