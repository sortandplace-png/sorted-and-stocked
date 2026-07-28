// components/StaffHandbookClient.tsx
// Staff handbook: ten questions in shift order, read top to bottom.
//
// Rebuilt against design_rules D-01..D-12 (SS-150). What changed and why:
//   D-01  numerals were brass at 24px -- brass above 20px and used as display
//         type. This page is the rule's cited example. Numerals are denim now.
//   D-03  pin dot stays on every card (Racquel confirmed 27 Jul).
//   D-09  chevron removed. A decorative pin and a real control must not share
//         a corner, so the card itself is the control and carries no arrow.
//   D-04  Cormorant for the question and the numeral, Inter for the answers.
//   D-05  mist cards at xl2 20px inside an xl3 28px shell.
//   D-11/12  18px Cormorant card label, 11px dusk subtitle, gap 11, py14 px18.
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

  // Falls back to English if a Spanish field is ever blank -- a missing
  // translation should degrade to readable, never to empty.
  const pick = (en: string, esVal?: string | null) => (es && esVal ? esVal : en);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-[34px] font-normal text-denim">{t('title')}</h1>
      <p className="text-[13px] text-dusk mb-5">{t('subtitle')}</p>

      <PageShell strip={t('strip', { count: articles.length })}>
        {articles.length === 0 ? (
          <p className="text-center italic text-dusk font-display text-lg py-10">{t('empty')}</p>
        ) : (
          <ol className="flex flex-col gap-[14px]">
            {articles.map((a, i) => {
              const open = openId === a.id;
              return (
                <li key={a.id}>
                  {/* The card is the control. No chevron: D-09 forbids a real
                      control sharing the corner with the decorative pin. */}
                  <button
                    onClick={() => setOpenId(open ? null : a.id)}
                    aria-expanded={open}
                    className="relative w-full text-left bg-mist rounded-xl2 border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px] flex gap-[11px]"
                  >
                    <Pin size="sm" />
                    {/* Denim, not brass -- D-01. Cormorant, because it is a
                        number and numbers are Cormorant -- D-04. */}
                    <span className="font-display text-[24px] text-denim leading-none shrink-0 w-7 pt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 pr-4 flex flex-col gap-[11px]">
                      <span className="block font-display text-[18px] text-denim leading-snug">
                        {pick(a.question, a.question_es)}
                      </span>
                      <span className="block text-[11px] text-dusk leading-relaxed">
                        {pick(a.short_answer, a.short_answer_es)}
                      </span>
                      {open && (
                        <span className="block text-[13px] text-denim leading-relaxed whitespace-pre-line border-t border-cardBorder pt-3">
                          {pick(a.detailed_answer, a.detailed_answer_es)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </PageShell>
    </div>
  );
}
