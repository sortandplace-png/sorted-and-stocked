// components/DashboardTipCard.tsx
// SS-408: the tip-of-the-day card. Presentation only -- selection (which
// set, which trigger, which tip today) happens server-side in
// lib/dashboard-tips.ts and the chosen tip arrives as a prop. Concept B
// tile: card ground, pin dot, brass eyebrow, denim display title. Both
// languages ride the normal i18n toggle via title_es/body_es.
'use client';

import { useLocale } from 'next-intl';
import type { DashboardTip } from '@/lib/dashboard-tips';

export default function DashboardTipCard({ tip }: { tip: DashboardTip }) {
  const locale = useLocale();
  const es = locale === 'es';
  const title = (es && tip.title_es) || tip.title_en;
  const body = (es && tip.body_es) || tip.body_en;
  if (!title && !body) return null;

  return (
    <div className="relative bg-card rounded-xl2 border border-cardBorder shadow-card p-4 pr-8">
      <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-brass mb-1">
        {es ? 'Consejo del Día' : 'Tip of the Day'}
      </p>
      {title && <h3 className="font-display text-[17px] text-denim leading-snug">{title}</h3>}
      {body && <p className="text-[13px] text-denim mt-1 leading-relaxed">{body}</p>}
    </div>
  );
}
