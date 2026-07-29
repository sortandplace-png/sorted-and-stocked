// app/about/page.tsx
// Public marketing page. Body copy pasted verbatim from the SEO content
// package, paragraph breaks preserved as given, not rewritten or shortened.
import type { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';

export const metadata: Metadata = {
  title: 'About Sort + Place | Who We Are',
  description:
    'Sort + Place was founded to solve the problem behind the mess — not the clutter itself, but the missing systems. Meet the team behind Lakewood’s trusted home management company.',
  openGraph: {
    title: 'About Sort + Place | Who We Are',
    description:
      'Sort + Place was founded to solve the problem behind the mess — not the clutter itself, but the missing systems. Meet the team behind Lakewood’s trusted home management company.',
    url: 'https://sortandplace.com/about',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <div className="bg-linen min-h-screen font-interDisplay">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[720px] mx-auto px-4 py-14 md:py-20">
        <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-8 text-center">
          About Sort + Place
        </h1>

        <div className="space-y-6 text-[17px] text-dusk leading-relaxed">
          <p>
            Sort + Place was founded on a simple observation: the homes that run smoothly aren’t the ones with the
            most help — they’re the ones with the best systems.
          </p>
          <p>
            We work with busy families who have tried organizers, hired staff, bought bins, and still feel like the
            house runs them instead of the other way around. The problem was never the clutter. The problem is that
            nobody built the backend.
          </p>
          <p>
            We build household operating systems: task management, procurement workflows, meal planning, staff
            training materials, and accountability tools — all designed for homes where multiple people need to
            maintain the same standard without constant supervision.
          </p>
          <p>
            Our approach is different because we stay. We don’t organize your pantry and leave. We set up the
            reorder system, train your staff on it, monitor it remotely, and adjust it when something stops working.
            The goal isn’t a beautiful before-and-after — it’s a house that works on Tuesday at 4pm when nobody’s
            watching.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-cardBorder text-center">
          <p className="text-sm text-dusk mb-1">
            <span className="font-medium text-denim">Serving:</span> Lakewood NJ, Ocean County, and the surrounding
            communities.
          </p>
          <p className="text-sm text-dusk">
            <a href="tel:+17189384342" className="hover:text-denim transition-colors">
              (718) 938-4342
            </a>{' '}
            ·{' '}
            <a href="tel:+17189162518" className="hover:text-denim transition-colors">
              (718) 916-2518
            </a>{' '}
            ·{' '}
            <a href="mailto:SortandPlace@gmail.com" className="hover:text-denim transition-colors">
              SortandPlace@gmail.com
            </a>
          </p>
        </div>

        <div className="mt-10 text-center">
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
