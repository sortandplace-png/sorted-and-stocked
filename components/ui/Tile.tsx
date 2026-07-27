// components/ui/Tile.tsx
// The mist action tile. Brass appears only as the eyebrow and the pin dot --
// never as a fill or a background (R9).
import PinDot from '@/components/ui/PinDot';

export default function Tile({
  eyebrow,
  label,
  subtitle,
  right,
  children,
  className = '',
}: {
  eyebrow?: string;
  label?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative bg-mist rounded-xl2 border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px] flex flex-col gap-[11px] ${className}`}
    >
      <PinDot />
      {(eyebrow || right) && (
        <div className="flex items-start justify-between gap-2 pr-4">
          {eyebrow && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate">{eyebrow}</span>
          )}
          {right}
        </div>
      )}
      {label && <span className="font-display text-[18px] text-denim leading-snug">{label}</span>}
      {subtitle && <span className="text-[11px] text-dusk">{subtitle}</span>}
      {children}
    </div>
  );
}
