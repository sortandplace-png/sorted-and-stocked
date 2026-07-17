// components/auth/AuthWordmark.tsx
// "Sort + Place" is the parent brand's own name, not a product name that
// changes per locale -- left as literal text in both languages, same as
// Footer.tsx's "Powered by Sort + Place" elsewhere in the app. Only the
// large variant (Welcome screen) shows the full "Sorted & Stocked"
// headline; the three form screens show just the small "Sort + Place"
// mark, per the finished Figma spec -- not a simplification, the actual
// design.
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function AuthWordmark({
  size = 'large',
  backHref,
}: {
  size?: 'large' | 'small';
  backHref?: string;
}) {
  const t = useTranslations('auth.wordmark');

  const content =
    size === 'large' ? (
      <>
        <div className="font-display font-light text-[42px] text-denim tracking-[0.06em] leading-none">
          Sorted &amp; Stocked
        </div>
        <div className="font-interDisplay text-[11px] font-medium tracking-[0.22em] uppercase text-dusk mt-2">
          {t('broughtToYouBy')} Sort <span className="text-brass">+</span> Place
        </div>
      </>
    ) : (
      <div className="font-display font-light text-[22px] text-denim tracking-[0.06em] leading-none">
        Sort <span className="text-brass font-normal">+</span> Place
      </div>
    );

  if (backHref) {
    return (
      <Link href={backHref} className="block text-center">
        {content}
      </Link>
    );
  }
  return <div className="text-center">{content}</div>;
}
