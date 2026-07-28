// components/StaffHandbookClient.tsx
// Staff handbook: ten questions in shift order, read top to bottom.
//
// Rebuilt against design_rules (SS-150 second pass). The two defects:
//
//   D-14 (supersedes D-09) -- the previous build deleted the chevron and left
//        no affordance, so detailed_answer became invisible and unreachable.
//        The arrow is back: vertically centred at the RIGHT EDGE, clear of the
//        pin dot in the top-right corner, rotating 180 degrees on open. The
//        whole row is the tap target; the arrow is the signal that it is.
//
//   D-15 (supersedes D-13) -- rows shipped at ~190px. Concept B: a dense,
//        scannable list, not a few large illustrated cards. py-12 px-16,
//        question 16px Cormorant, answer 13px Inter dusk on ONE line, numeral
//        15px Cormorant denim because a numeral is a label, not display type.
//        Roughly 72-88px collapsed so five or six fit a phone screen.
//
// No fixed height anywhere: Spanish runs 15-30% longer and would clip (D-15).
// Kept from the pass that succeeded: denim strip, denim numerals, pin dot on
// every row, mist fills, Cormorant question / Inter answer (D-03, D-04).
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
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

  // Degrades to English if a Spanish field is blank -- readable, never empty.
  const pick = (en: string, esVal?: string | null) => (es && esVal ? esVal : en);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* SS-224: the grey subtitle is gone. The denim strip already says
          "10 questions - shift order", and the subtitle was hardcoded English
          on a page whose whole audience is Spanish-speaking. */}
      <h1 className="font-display text-[34px] font-normal text-denim mb-5">{t('title')}</h1>

      <PageShell strip={t('strip', { count: articles.length })}>
        {articles.length === 0 ? (
          <p className="text-center italic text-dusk font-display text-lg py-10">{t('empty')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {articles.map((a, i) => {
              const open = openId === a.id;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setOpenId(open ? null : a.id)}
                    aria-expanded={open}
                    className="relative w-full text-left bg-mist rounded-xl2 border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow py-[12px] px-[16px] flex items-center gap-3"
                  >
                    {/* Pin stays top-right at 11/12; the chevron is centred at
                        the right edge, so a decorative dot and a real control
                        never share a corner (D-14). */}
                    <Pin size="sm" />

                    {/* 15px: a numeral is a label, not display type (D-15). */}
                    <span className="font-display text-[15px] text-denim shrink-0 w-6 tabular-nums">
                      {i + 1}
                    </span>

                    <span className="flex-1 min-w-0 pr-2">
                      <span className="block font-display text-[16px] text-denim leading-snug">
                        {pick(a.question, a.question_es)}
                      </span>
                      {/* One line collapsed -- truncated, not clipped by a
                          fixed height, so longer Spanish still lays out. */}
                      <span
                        className={`block text-[13px] text-dusk leading-snug ${open ? '' : 'truncate'}`}
                      >
                        {pick(a.short_answer, a.short_answer_es)}
                      </span>

                      {open && (
                        <span className="block text-[13px] text-denim leading-relaxed whitespace-pre-line border-t border-cardBorder mt-2 pt-2">
                          {pick(a.detailed_answer, a.detailed_answer_es)}
                        </span>
                      )}
                    </span>

                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className={`shrink-0 self-center text-dusk transition-transform ${open ? 'rotate-180' : ''}`}
                    />
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
