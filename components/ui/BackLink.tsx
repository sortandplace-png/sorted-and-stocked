// components/ui/BackLink.tsx
// The "← Back" affordance, extracted from the inline breadcrumb the Yom Tov
// Year View was carrying so every page uses one implementation.
//
// Two modes, because "back" means two different things:
//   <BackLink href="..." label="Tools" />  a fixed destination (breadcrumb)
//   <BackLink />                           router.back(), browser history
//
// The history mode carries a guard the plain router.back() version does not:
// these pages are bookmarkable and get opened directly from a link or a
// fresh tab, and router.back() with no history to return to does NOTHING --
// a control that visibly exists and silently ignores you. When there is no
// history, it navigates to `fallbackHref` instead, so the link always goes
// somewhere.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const STYLE =
  'inline-block text-[13px] text-dusk hover:text-denim transition-colors mb-4';

export default function BackLink({
  href,
  label,
  fallbackHref,
}: {
  /** Fixed destination. Renders a real <a>, so middle-click and open-in-new-tab work. */
  href?: string;
  /** Overrides the default "Back" wording, e.g. "Tools". Already translated. */
  label?: string;
  /** Where history mode goes when there is no history to go back to. */
  fallbackHref?: string;
}) {
  const router = useRouter();
  const t = useTranslations('common');
  const text = `← ${label ?? t('back')}`;

  if (href) {
    return (
      <Link href={href} className={STYLE}>
        {text}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // length <= 1 means this tab has no prior entry -- opened directly,
        // from a bookmark, or as the first page of the session.
        if (fallbackHref && typeof window !== 'undefined' && window.history.length <= 1) {
          router.push(fallbackHref);
          return;
        }
        router.back();
      }}
      className={STYLE}
    >
      {text}
    </button>
  );
}
