// app/services/page.tsx
// Public marketing page. Copy pasted verbatim from the SEO content package,
// not rewritten or shortened. Same visual family as the homepage's service
// bento cards (Pin, icon circle, denim title, dusk body) so this reads as
// a sibling page, not a different site.
import type { Metadata } from 'next';
import { Home, ChefHat, Users, HeartHandshake, Sparkles, RotateCw } from 'lucide-react';
import Pin from '@/components/PinAccent';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';

export const metadata: Metadata = {
  title: 'Our Services | Sort + Place — Home Organization & Household Management',
  description:
    'Full-home organization, kitchen and pantry setup, staff management, and newlywed packages. Systems that work for real families. Serving Lakewood NJ.',
  openGraph: {
    title: 'Our Services | Sort + Place — Home Organization & Household Management',
    description:
      'Full-home organization, kitchen and pantry setup, staff management, and newlywed packages. Systems that work for real families. Serving Lakewood NJ.',
    url: 'https://sortandplace.com/services',
    type: 'website',
  },
};

const SERVICES = [
  {
    icon: Home,
    title: 'Full Home Organization',
    body: 'Every room, every closet, every drawer. We build systems that match how your family actually lives — labeled, sourced, and maintainable without us.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen & Pantry Setup',
    body: 'Kosher kitchen flow, labeled storage, expiration tracking, and a stocked pantry that staff can maintain on their own. Fleishig, milchig, pareve — everything in its place.',
  },
  {
    icon: Users,
    title: 'Household Operations & Staff Management',
    body: 'Task systems, daily checklists, bilingual SOPs, shift handover protocols, and accountability tools so your home runs whether you’re there or not.',
  },
  {
    icon: HeartHandshake,
    title: 'Newlywed Package',
    body: 'Setting up your first home right: kitchen essentials, closet systems, pantry stocking, and the organizational foundation that saves arguments later.',
  },
  {
    icon: Sparkles,
    title: 'Pesach Prep',
    body: 'Full Pesach kitchen turnover, covering, labeling, inventory of Pesach supplies, and a system your staff can follow every year without retraining.',
  },
  {
    icon: RotateCw,
    title: 'Ongoing Management',
    body: 'Weekly meal planning, grocery ordering, vendor coordination, inventory monitoring, and regular check-ins. The invisible work that keeps everything running.',
  },
];

export default function ServicesPage() {
  return (
    <div className="bg-linen min-h-screen font-interDisplay">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[1100px] mx-auto px-4">
        <section className="py-14 md:py-20 text-center max-w-[720px] mx-auto">
          <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-4">
            Our Services
          </h1>
          <p className="text-lg text-dusk">
            Systems that work for real families — not a one-time reset, a way of running the house.
          </p>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="grid md:grid-cols-2 gap-5">
            {SERVICES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="relative bg-card border border-cardBorder rounded-2xl shadow-card p-6"
              >
                <Pin size="sm" />
                <div className="w-11 h-11 rounded-full bg-brass/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brass" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h2 className="font-display font-bold text-xl text-denim mb-2">{title}</h2>
                <p className="text-sm text-dusk leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16 md:pb-24 text-center">
          <a
            href="/contact"
            className="inline-block bg-brass text-denim font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
          >
            Book Your Consultation
          </a>
        </section>
      </div>

      <MarketingFooter />
    </div>
  );
}
