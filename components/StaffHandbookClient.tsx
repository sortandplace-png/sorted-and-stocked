// components/StaffHandbookClient.tsx
// Staff handbook: ten questions, shift order, as a BENTO GRID.
//
// D-20 (supersedes D-15 for this page) -- RACQUEL: "bento never ever list".
// She wrote D-15 and overrode it; its reading-order argument is recorded as
// noted and rejected. Any future rebuild of this page as a single-column list
// citing D-15 is wrong: D-20 governs the handbook.
//
// D-21 (supersedes D-14) -- the gold pin dot IS the collapse control. No
// chevrons, no arrows. Tap the pin or tap the card.
//
// D-19 -- answers render DENIM, not dusk. dusk #7A8A9C on mist #E8EEF6 is
// about 2.9:1, below AA, and these answers carry instructions.
//
// Also kept: no grey subtitle (SS-224), 15px Cormorant denim numerals
// (a numeral is a label, not display type), mist fills, denim strip.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import PageShell from '@/components/ui/PageShell';
import Pin from '@/components/ui/Pin';

export type HandbookArticle = {
  id: string;
  question: string;
  short_answer: string;
  detailed_answer: string;
  question_es?: string | null;
  short_answer_es?: string | null;
  detailed_answer_es?: string | null;
};

// The bento rhythm. Each pair sums to 6 so rows stay flush on desktop while
// card sizes visibly vary -- written as literal class strings because Tailwind
// cannot see dynamically built ones.
const SPANS = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-4',
  'lg:col-span-3',
  'lg:col-span-3',
  'lg:col-span-2',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-2',
];

export default function StaffHandbookClient({
  articles,
}: {
  articles: HandbookArticle[];
  propertyId: string;
}) {
  const t = useTranslations('staffHandbook');
  const locale = useLocale();
  const es = locale === 'es';
  const [openId, setOpenId] = useState<string | null>(null);

  // Degrades to English if a Spanish field is blank -- readable, never empty.
  const pick = (en: string, esVal?: string | null) => (es && esVal ? esVal : en);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-[34px] font-normal text-denim mb-5">{t('title')}</h1>

      <PageShell strip={t('strip', { count: articles.length })}>
        {articles.length === 0 ? (
          <p className="text-center italic text-dusk font-display text-lg py-10">{t('empty')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-[14px] auto-rows-fr">
            {articles.map((a, i) => {
              const open = openId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setOpenId(open ? null : a.id)}
                  aria-expanded={open}
                  // No fixed height: Spanish runs 15-30% longer and would clip.
                  className={`relative text-left bg-mist rounded-xl2 border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px] flex flex-col gap-[11px] ${
                    open ? 'sm:col-span-2 lg:col-span-6' : SPANS[i % SPANS.length]
                  }`}
                >
                  {/* The pin is the control (D-21). Nothing else marks it. */}
                  <Pin size="sm" />

                  <span className="font-display text-[15px] text-denim tabular-nums">{i + 1}</span>

                  <span className="font-display text-[18px] text-denim leading-snug pr-4">
                    {pick(a.question, a.question_es)}
                  </span>

                  {/* Denim, not dusk -- D-19. These are instructions. */}
                  <span className="text-[13px] text-denim leading-relaxed">
                    {pick(a.short_answer, a.short_answer_es)}
                  </span>

                  {open && (
                    <span className="text-[13px] text-denim leading-relaxed whitespace-pre-line border-t border-cardBorder pt-3">
                      {pick(a.detailed_answer, a.detailed_answer_es)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PageShell>
    </div>
  );
}
