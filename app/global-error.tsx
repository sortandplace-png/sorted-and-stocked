// app/global-error.tsx
// The last line of defence. app/error.tsx catches exceptions inside a
// route, but it renders INSIDE the root layout -- so if the root layout
// itself throws (the i18n provider, the font loader, a top-level provider),
// that boundary never mounts and the user is back to a blank page.
//
// This one replaces the entire document, which is why it must render its
// own <html> and <body>: at this point nothing else has. It therefore
// cannot use ANY app provider, and must not import shared components --
// it exists precisely for the case where those are what failed.
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            background: '#FFFAF3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">
              🧺
            </p>
            <h1 style={{ fontSize: 20, color: '#2E4A62', margin: '0 0 8px' }}>
              Sorted &amp; Stocked couldn&apos;t load
            </h1>
            <p style={{ fontSize: 14, color: '#6B7A88', margin: '0 0 4px' }}>
              Nothing you did caused this, and nothing has been lost.
            </p>
            <p style={{ fontSize: 14, color: '#6B7A88', margin: '0 0 20px' }} lang="es">
              No se pudo cargar. No fue culpa suya y no se perdió nada.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={reset}
                style={{
                  padding: '11px 16px',
                  borderRadius: 999,
                  background: '#2E4A62',
                  color: '#fff',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again · Reintentar
              </button>
              <a
                href="/properties"
                style={{
                  padding: '11px 16px',
                  borderRadius: 999,
                  background: 'transparent',
                  color: '#2E4A62',
                  border: '1px solid #E8DDD0',
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Go to my properties · Ir a mis propiedades
              </a>
            </div>

            {error.digest && (
              <p style={{ fontSize: 11, color: '#9AA7B2', marginTop: 18 }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
