// components/Logo.tsx
// Circular house-mark logo, replacing the square /icons/icon-512.png in-app
// (the PWA manifest icons are unrelated and untouched — those are raster
// files required by the OS install/home-screen surface, not this component).

function HouseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 40 L50 12 L85 40 M22 33 V62 H78 V33 M60 18 V26 H68 V18"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Circular glyph-only mark — used at every size, from the small nav header
// icons up to the large login-screen presentation. The wordmark/tagline
// stay as separate JSX wherever they're already rendered (e.g. login page's
// existing "Sign in" heading + tagline) rather than baked into this
// component, so nothing ends up duplicated.
export function LogoMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <div className={`${className} rounded-full bg-cream border border-gold-light flex items-center justify-center shrink-0 overflow-hidden`}>
      <HouseGlyph className="w-1/2 h-1/2 text-gold-dark" />
    </div>
  );
}
