// app/error.tsx
// Route-level error boundary. Before this the app had NO error boundary of
// any kind, so any client-side exception fell through to Next.js's default:
// a blank cream page with one line of technical text and no way back. A
// housekeeper on her phone got that with no route home -- the difference
// between "the app is being fussy" and "the app is broken". Same class as
// the add-property dead-end (SS-383): every screen needs an escape.
//
// DELIBERATELY DEPENDENCY-FREE. No next-intl, no design tokens beyond raw
// hex, no shared components. An error boundary must not rely on anything
// that could itself be what broke -- if the i18n provider or a shared
// component threw, a boundary importing it would throw too and the user
// would be back to the blank page. Both languages are hardcoded for the
// same reason: staff read the Spanish, and a boundary is exactly where a
// missing translation must not matter.
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keeps the real error reachable in the browser console and in Vercel's
    // logs -- the friendly copy below deliberately does not show it, but it
    // must not be swallowed either.
    console.error('[app error boundary]', error);
  }, [error]);

  return (
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
          Something went wrong on this page
        </h1>
        <p style={{ fontSize: 14, color: '#6B7A88', margin: '0 0 4px' }}>
          Nothing you did caused this, and nothing has been lost.
        </p>
        <p style={{ fontSize: 14, color: '#6B7A88', margin: '0 0 20px' }} lang="es">
          Algo salió mal en esta página. No fue culpa suya y no se perdió nada.
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
          {/* A real anchor, not router.push -- if the router or a provider
              is the thing that broke, a full document load still works. */}
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

        {/* SS-431: ALWAYS print a reference, never conditionally. A digest
            only exists for SERVER errors -- the crash Racquel keeps hitting
            is a client-side exception, which has none, so the old
            digest-only block rendered nothing and three sessions asked her
            for a string the UI never showed. Client errors carry their real
            message (Next only redacts server messages), so show digest when
            it exists, the raw message otherwise, plus the path -- and make
            it selectable so a phone long-press can copy it. */}
        <p
          style={{
            fontSize: 11,
            color: '#6B7A88',
            marginTop: 18,
            userSelect: 'all',
            WebkitUserSelect: 'all',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Reference · Referencia:{' '}
          {error.digest || `${error.name}: ${error.message}` || 'unknown'}
          {typeof window !== 'undefined' ? ` @ ${window.location.pathname}` : ''}
        </p>
      </div>
    </div>
  );
}
