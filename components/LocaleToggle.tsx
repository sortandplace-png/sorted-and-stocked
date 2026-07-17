'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/i18n/locale-constants';

// 'dark' -- the shared app chrome (denim header/nav) the toggle normally
// lives in. 'light' -- the entry flow (Welcome/Sign In/Sign Up/Forgot
// Password), which sits directly on the linen page background rather than
// a denim bar; Figma specifies a distinct, more compact treatment for
// that context (denim-tinted translucent pill, not white/10 on white
// text), not just a recolor of the chrome version.
export default function LocaleToggle({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const locale = useLocale();
  const router = useRouter();

  function setLocale(next: 'en' | 'es') {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  if (variant === 'light') {
    return (
      <div className="inline-flex items-center rounded-full p-[3px]" style={{ background: 'rgba(46,74,98,.07)' }}>
        {(['en', 'es'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`font-interDisplay text-[10px] font-bold tracking-[0.12em] uppercase px-3 py-[5px] rounded-full leading-none transition-colors ${
              locale === l ? 'bg-denimBlue text-white' : 'text-dusk'
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'en' ? 'bg-brass text-white' : 'text-white/60'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        aria-pressed={locale === 'es'}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'es' ? 'bg-brass text-white' : 'text-white/60'
        }`}
      >
        ES
      </button>
    </div>
  );
}
