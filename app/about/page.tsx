// app/about/page.tsx
// Public marketing page. Body copy pasted verbatim from the SEO content
// package, paragraph breaks preserved as given, not rewritten or shortened.
import type { Metadata } from 'next';
import Image from 'next/image';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';

export const metadata: Metadata = {
  title: 'About Sort + Place | Who We Are',
  description:
    'Sort + Place was founded to solve the problem behind the mess. Not the clutter itself, but the missing systems. Meet the team behind Lakewood’s trusted home management company.',
  openGraph: {
    title: 'About Sort + Place | Who We Are',
    description:
      'Sort + Place was founded to solve the problem behind the mess. Not the clutter itself, but the missing systems. Meet the team behind Lakewood’s trusted home management company.',
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
            most help. They’re the ones with the best systems.
          </p>
          <p>
            We work with busy families who have tried organizers, hired staff, bought bins, and still feel like the
            house runs them instead of the other way around. The problem was never the clutter. The problem is that
            nobody built the backend.
          </p>
          {/* SS-532 Option A (Racquel ruling): the service is Sort + Place
              DOING the work, not teaching the client's staff to. Paragraphs
              1 and 2 above are deliberately untouched -- "hired staff" in
              paragraph 2 describes what the client already tried and why it
              failed, so removing it would weaken the point.
              SCOPE WARNING: this reframes the SERVICE copy only. The product
              genuinely is staff-facing (Handbook, training videos, bilingual
              SOPs, staff dashboard) and a product page must NOT inherit this
              ruling by reflex -- do not strip "staff" site-wide the way the
              ampersand was over-applied. */}
          <p>
            We build household operating systems: task management, procurement workflows, meal planning, documented
            procedures, and accountability tools, designed for homes where the same standard has to hold whether or
            not anyone is watching.
          </p>
          {/* SS-535. CROP IS DELIBERATE AND MUST NOT BE WIDENED. This file is
              cropped from a larger illustration specifically to exclude text
              carrying generation errors: a misspelled pantry shelf label
              ("SWOAR"), duplicated closet bin labels (SHIRTS twice,
              ACCESSORIES twice), and an invalid calendar date (a "39" in a
              November grid). ANY wider framing reintroduces all three. Do not
              source, request or substitute a wider crop -- place as supplied.
              Decorative, so alt is empty: the paragraphs either side already
              carry the meaning, and describing the illustration would make a
              screen reader announce the very labels the crop removes. */}
          <Image
            src="/about-header.jpg"
            alt=""
            width={1200}
            height={758}
            className="w-full h-auto rounded-xl2 border border-cardBorder shadow-card my-2"
          />
          <p>
            Our approach is different because we stay. We don’t organize your pantry and leave. We set up the
            reorder system, we run it, we watch it, and we fix it when something stops working. The goal isn’t a
            beautiful before-and-after. It’s a house that works on Tuesday at 4pm when nobody’s watching.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-cardBorder text-center">
          <p className="text-sm text-dusk mb-1">
            <span className="font-medium text-denim">Serving:</span> Lakewood NJ, Ocean County, and the surrounding
            communities.
          </p>
          {/* SS-454/SS-434: email only, no phone numbers anywhere on the
              marketing site. */}
          <p className="text-sm text-dusk">
            <a href="mailto:SortandPlace@gmail.com" className="hover:text-denim transition-colors">
              SortandPlace@gmail.com
            </a>
          </p>
        </div>

        <div className="mt-10 text-center">
          <a
            href="/contact"
            className="inline-block bg-denim text-white font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
          >
            Book Your Consultation
          </a>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
