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
    <div className="bg-linen min-h-screen flex flex-col font-interDisplay">
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
          {/* SS-535. ONE image on About, the wide frame, replacing the two
              1200x758 crops (Racquel, 3 Aug: the crops are "cut off and
              wrong", use the wide picture only).

              THIS REVERSES THE OLD "NEVER SOURCE WIDER" RULE ON THIS ROW, and
              the reason is worth keeping, because the original rule had it
              backwards. The crops were tighter, so at the 688px column width
              this page actually renders at they MAGNIFIED the generation
              errors roughly 4x: "Order Pet Foed Delivery" was plainly
              readable, the calendar row visibly skipped from 25 to 27 to 29,
              and the inventory checklist was sliced mid-word. The wide frame
              renders the same text at about a quarter the size, where it
              reads as texture rather than as misspelt words, and nothing is
              truncated. Wider is what hides the errors here; tighter is what
              exposed them.

              WHAT IS STILL DELIBERATELY CROPPED: the bottom 78px of the
              source carried the retired "SORT & PLACE" ampersand wordmark
              TWICE, once on a paper bag and once as a floor watermark. Both
              are cut. Verified by magnifying the bottom-right corner of the
              final file, not by eye at page scale (SS-549/SS-556: a wordmark
              baked into pixels is invisible to every string audit we run).
              DO NOT restore the bottom of this image. */}
          <Image
            src="/about-header.jpg"
            alt="Two household managers in a kitchen, working from a family calendar, a weekly staff and vendor schedule, a daily errands list, and a household inventory checklist."
            width={1600}
            height={698}
            className="w-full h-auto rounded-xl3 border border-cardBorder shadow-card my-2"
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
