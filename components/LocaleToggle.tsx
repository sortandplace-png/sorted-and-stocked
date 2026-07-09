'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/i18n/locale-constants';

export default function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();

  function setLocale(next: 'en' | 'es') {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="inline-flex items-center rounded-full border border-gold/40 bg-cream p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'en' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        aria-pressed={locale === 'es'}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'es' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
        }`}
      >
        ES
      </button>
    </div>
  );
}
