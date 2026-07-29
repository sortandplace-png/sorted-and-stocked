// app/faq/page.tsx
// Public marketing page. Questions and answers pasted verbatim from the SEO
// content package, not rewritten or shortened.
//
// A plain client component for the expand/collapse only -- the questions
// and answers themselves are static, server-rendered content (this file
// stays a server component; only the disclosure toggle needs client state,
// so it lives in its own small child rather than making the whole page
// 'use client' and losing server rendering for the crawlable text).
import type { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';
import FaqList from '@/components/marketing/FaqList';

export const metadata: Metadata = {
  title: 'FAQ | Sort + Place — Common Questions',
  description:
    'Answers to common questions about home organization, household management, staff training, and our process. Sort + Place — Lakewood NJ.',
  openGraph: {
    title: 'FAQ | Sort + Place — Common Questions',
    description:
      'Answers to common questions about home organization, household management, staff training, and our process. Sort + Place — Lakewood NJ.',
    url: 'https://sortandplace.com/faq',
    type: 'website',
  },
};

const FAQS = [
  {
    q: 'How is this different from a regular organizer?',
    a: 'Most organizers focus on the visible result — the pretty pantry, the color-coded closet. We focus on the system behind it: who restocks it, how they know what to buy, where the reorder link is, and what happens when someone new starts. The organization is a byproduct of the system, not the other way around.',
  },
  {
    q: 'Do you work with household staff?',
    a: 'Yes — staff management is one of our core services. We build bilingual task checklists, standard operating procedures, shift handover protocols, and visual reference materials so your staff can maintain your standards independently.',
  },
  {
    q: 'What does "ongoing management" include?',
    a: 'Weekly meal planning with grocery orders actually placed, vendor scheduling and confirmation, inventory monitoring, supply reordering, and regular check-ins. Think of it as a fractional house manager.',
  },
  {
    q: 'Do you only work in Lakewood?',
    a: 'We’re based in Lakewood NJ and serve Ocean County and the surrounding area. For larger projects or ongoing management contracts, we’ll travel further — reach out and we’ll discuss.',
  },
  {
    q: 'How long does a full home organization take?',
    a: 'It depends on the size of the home and the scope. A single room can be done in a day. A full home with pantry, closets, playroom, and staff systems typically takes 1-2 weeks of active work, plus a training and handover period.',
  },
  {
    q: 'What’s the newlywed package?',
    a: 'Everything you need to set up your first home right — kitchen essentials sourced and organized, closet systems built, pantry stocked and labeled, and a basic household operations guide so you start with systems instead of building them under pressure later.',
  },
  {
    q: 'Is everything kosher-aware?',
    a: 'Yes. Fleishig, milchig, pareve separation is built into every kitchen system we design. Pesach prep is a separate service with its own protocol.',
  },
  {
    q: 'Can I just get the app?',
    a: 'Sorted & Stocked, our household management app, is currently available to Sort + Place clients. It includes inventory tracking, meal planning, staff task management, and more. Ask about it during your consultation.',
  },
];

export default function FaqPage() {
  return (
    <div className="bg-linen min-h-screen font-interDisplay">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[760px] mx-auto px-4 py-14 md:py-20">
        <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-4 text-center">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-dusk mb-12 text-center">
          Answers to what people usually ask before they book.
        </p>

        <FaqList items={FAQS} />

        <div className="mt-14 text-center">
          <a
            href="/contact"
            className="inline-block bg-brass text-denim font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
          >
            Book Your Consultation
          </a>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
