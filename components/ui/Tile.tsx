// components/ui/Tile.tsx
// The mist action tile. Brass appears only as the eyebrow and the pin dot --
// never as a fill or a background (R9).
//
// SS-250: extended rather than replaced. Everything that used Tile before
// still gets the identical div with the identical classes -- the new props
// are all optional and all default to the old behaviour.
//
//   icon      a line icon rendered above the label
//   centered  centres icon/label/subtitle, for a grid of square actions
//   active    D-18's selected face: denim fill, white text. NOT brass --
//             brass is never a fill, which is the whole reason this
//             component exists.
//   href/onClick  renders a real <Link> or <button> instead of a <div>,
//             so an action tile is actually operable by keyboard and
//             announced correctly, rather than a div with a handler.
//   pin       defaults true. Pure navigation tiles pass pin={false},
//             matching the Dashboard Quick Actions precedent: the dot
//             marks a card that holds or does something, not a signpost.
import Link from 'next/link';
import Pin from '@/components/ui/Pin';

export default function Tile({
  eyebrow,
  label,
  subtitle,
  right,
  icon,
  centered = false,
  active = false,
  href,
  onClick,
  disabled = false,
  pin = true,
  children,
  className = '',
}: {
  eyebrow?: string;
  label?: string;
  subtitle?: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  centered?: boolean;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  pin?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const shell = [
    'relative rounded-xl2 border shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px] flex flex-col gap-[11px]',
    active ? 'bg-denim border-denim' : 'bg-mist border-brass/30',
    centered ? 'items-center text-center justify-center' : '',
    disabled ? 'opacity-40' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      {pin && <Pin size="sm" />}
      {(eyebrow || right) && (
        <div className={`flex items-start gap-2 pr-4 ${centered ? 'justify-center' : 'justify-between'}`}>
          {eyebrow && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.2em] truncate ${
                active ? 'text-white/70' : 'text-brass'
              }`}
            >
              {eyebrow}
            </span>
          )}
          {right}
        </div>
      )}
      {icon}
      {label && (
        <span className={`font-display text-[18px] leading-snug ${active ? 'text-white' : 'text-denim'}`}>
          {label}
        </span>
      )}
      {subtitle && (
        <span className={`text-[11px] ${active ? 'text-white/80' : 'text-dusk'}`}>{subtitle}</span>
      )}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={`${shell} text-left`}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
