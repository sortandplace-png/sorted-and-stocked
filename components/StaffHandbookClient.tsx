// components/StaffHandbookClient.tsx
// Card per question, short answer always visible, detail on expand. Reads top
// to bottom in shift order -- it is a handbook, not a search result.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import Pin from '@/components/PinAccent';

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
      <p className="text-[13px] text-dusk mb-6">{t('subtitle')}</p>

      {articles.length === 0 ? (
        <p className="text-center italic text-dusk font-display text-lg py-10">{t('empty')}</p>
      ) : (
        <ol className="space-y-3">
          {articles.map((a, i) => {
            const open = openId === a.id;
            return (
              <li
                key={a.id}
                className="relative bg-card border border-cardBorder rounded-xl2 shadow-card"
              >
                <Pin size="sm" />
                <button
                  onClick={() => setOpenId(open ? null : a.id)}
                  aria-expanded={open}
                  className="w-full text-left px-5 py-4 flex items-start gap-3"
                >
                  <span className="font-display text-[24px] text-brass leading-none shrink-0 w-7">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 pr-4">
                    <span className="block font-display text-[17px] text-denim leading-snug">
                      {pick(a.question, a.question_es)}
                    </span>
                    <span className="block text-[13px] text-dusk mt-1.5 leading-relaxed">
                      {pick(a.short_answer, a.short_answer_es)}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-dusk mt-1 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {open && (
                  <div className="px-5 pb-5 pl-[60px]">
                    <p className="text-[14px] text-denim leading-relaxed whitespace-pre-line border-t border-cardBorder pt-3">
                      {pick(a.detailed_answer, a.detailed_answer_es)}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
