// components/help/HelpClient.tsx
// Property-agnostic (app/help/page.tsx has no [id] param) -- one Help
// Center shared by every property, category-grouped card grid + accordion,
// search matching question/answer/keywords, deep-linkable via ?article=.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Pin from '@/components/PinAccent';

export type HelpArticle = {
  id: string;
  category: string;
  question: string;
  short_answer: string;
  detailed_answer: string;
  question_es?: string | null;
  short_answer_es?: string | null;
  detailed_answer_es?: string | null;
  keywords: string[];
};

type Props = {
  articles: HelpArticle[];
};

const CATEGORY_ORDER = [
  'Getting Started',
  'Inventory',
  'Shopping',
  'Recipes & Meals',
  'Jewish Calendar',
  'Staff & Permissions',
  'Multi-Property',
  'Troubleshooting',
];

export default function HelpClient({ articles }: Props) {
  const t = useTranslations('help');
  const locale = useLocale();
  const isEs = locale === 'es';
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('article');

  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(deepLinkId);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const articleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (deepLinkId && articleRefs.current[deepLinkId]) {
      articleRefs.current[deepLinkId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [deepLinkId]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = articles.filter((a) => {
      if (!q) return true;
      const question = isEs && a.question_es ? a.question_es : a.question;
      const shortAnswer = isEs && a.short_answer_es ? a.short_answer_es : a.short_answer;
      return (
        question.toLowerCase().includes(q) ||
        shortAnswer.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });

    const byCategory = new Map<string, HelpArticle[]>();
    for (const article of filtered) {
      const list = byCategory.get(article.category) ?? [];
      list.push(article);
      byCategory.set(article.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      items: byCategory.get(c)!,
    }));
  }, [articles, query, isEs]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-denim mb-1">
        {t('title')}
      </h1>
      <p className="text-xs uppercase tracking-wide text-dusk mb-6">
        {t('subtitle')}
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full rounded-xl2 border border-cardBorder bg-card px-4 py-3 text-sm text-denim
                   focus:outline-none focus:border-brass mb-7"
      />

      {grouped.length === 0 && (
        <p className="text-center italic text-dusk font-display text-lg py-10">
          {t('noResults')}
        </p>
      )}

      {grouped.map(({ category, items }) => {
        const isCollapsed = collapsedCategories.has(category);
        return (
          <div key={category} className="mb-6">
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between rounded-xl2 bg-denim text-white
                         px-4 py-3 text-xs font-medium uppercase tracking-wide"
            >
              <span>{t(`categories.${category}`, { default: category })}</span>
              <span className="flex items-center gap-2">
                <span className="opacity-75 font-normal normal-case">{items.length}</span>
                <span className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                  &#9662;
                </span>
              </span>
            </button>

            {!isCollapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {items.map((article) => {
                  const isOpen = openId === article.id;
                  const question = isEs && article.question_es ? article.question_es : article.question;
                  const shortAnswer =
                    isEs && article.short_answer_es ? article.short_answer_es : article.short_answer;
                  const detailedAnswer =
                    isEs && article.detailed_answer_es
                      ? article.detailed_answer_es
                      : article.detailed_answer;

                  return (
                    <div
                      key={article.id}
                      ref={(el) => {
                        articleRefs.current[article.id] = el;
                      }}
                      onClick={() => setOpenId(isOpen ? null : article.id)}
                      className="relative rounded-xl2 bg-card p-4 cursor-pointer
                                 shadow-card hover:shadow-cardHover transition-shadow"
                    >
                      <Pin size="sm" />
                      <p className="font-display font-semibold text-lg text-denim pr-4 mb-1">
                        {question}
                      </p>
                      <p className="text-sm text-dusk leading-relaxed">{shortAnswer}</p>
                      {isOpen && (
                        <p className="text-sm text-denim leading-relaxed mt-3 pt-3 border-t border-cardBorder">
                          {detailedAnswer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
