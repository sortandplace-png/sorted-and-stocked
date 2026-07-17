// components/auth/AuthGoogleButton.tsx
// Real official Google "G" mark, brand colors -- not palette-swapped, same
// as Figma's own note on this. onClick wires to the real
// supabase.auth.signInWithOAuth call the caller already has (see login and
// signup pages) -- this component is presentation only.
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function AuthGoogleButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-white text-denim font-interDisplay text-sm font-semibold tracking-[0.03em] px-5 py-[13px] rounded-full flex items-center justify-center gap-2.5 transition-shadow disabled:opacity-50"
      style={{ border: '1.5px solid rgba(46,74,98,.2)' }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = '#6B8DBE';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,141,190,.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(46,74,98,.2)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <GoogleG />
      {children}
    </button>
  );
}
