// components/auth/AuthContactLink.tsx
// Figma's finished entry-flow design has no footer at all -- Sitemap and
// the rest genuinely don't belong here (no property context exists before
// sign-in), but Racquel still wants a way for someone without an account
// to reach out. Same real Gmail-compose link Footer.tsx already uses
// elsewhere in the app, just this one link, styled as quietly as the
// "poweredBy" line it sits near rather than as a real footer.
'use client';

import { useTranslations } from 'next-intl';

export default function AuthContactLink() {
  const t = useTranslations('auth');

  return (
    <a
      href="https://mail.google.com/mail/?view=cm&fs=1&to=sortandplace@gmail.com&su=Sorted%20%26%20Stocked%20Support"
      target="_blank"
      rel="noopener noreferrer"
      className="font-interDisplay text-xs text-dusk tracking-[0.04em] hover:text-denimBlue transition-colors"
    >
      {t('contact')}
    </a>
  );
}
