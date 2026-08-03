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
          {/* SS-535 image 1 of 2. CROP IS DELIBERATE AND MUST NOT BE WIDENED.
              Cropped from a larger illustration to exclude text carrying
              generation errors: a misspelled pantry shelf label ("SWOAR"),
              duplicated closet bin labels (SHIRTS twice, ACCESSORIES twice),
              and an invalid calendar date (a "39" in a November grid). Any
              wider framing reintroduces all three.

              3 Aug: THE CROP AS SUPPLIED DID NOT ACTUALLY EXCLUDE THE THIRD
              ONE. The top 26px still carried the date strip "26 27 28 39 30",
              so the invalid 39 was live on this page. Re-cropped tighter (top
              26px dropped, sides trimmed to hold the 1200x758 the pair shares)
              and the strip is gone. Recorded on SS-535 -- the point is that a
              crop is only as good as someone checking it, and the note saying
              the errors were excluded had been trusted rather than verified. */}
          <Image
            src="/about-header.jpg"
            alt="Two professional organizers in a home laundry and pantry, with household systems shown around them."
            width={1200}
            height={758}
            className="w-full h-auto rounded-xl3 border border-cardBorder shadow-card my-2"
          />
          <p>
            Our approach is different because we stay. We don’t organize your pantry and leave. We set up the
            reorder system, we run it, we watch it, and we fix it when something stops working. The goal isn’t a
            beautiful before-and-after. It’s a house that works on Tuesday at 4pm when nobody’s watching.
          </p>
          {/* SS-535 image 2 of 2, placed after the closing line per the
              ruling. SAME RULE: never re-source wider. The full generation
              carries the retired "SORT & PLACE" ampersand wordmark twice, and
              a calendar whose weekday headers are generated gibberish; this
              crop excludes both.

              KNOWN AND LEFT IN, recorded rather than silently shipped (SS-540)
              -- the corkboard reads "Order Pet Foed Delivery", and the visible
              calendar row runs 25, 27, 29. SS-535 describes that line as
              correctly spelled and the broken date sequence as outside the
              crop; both claims are wrong against the delivered file. Neither
              is croppable without destroying the composition, so this needs a
              regenerated asset, not a reframe. */}
          <Image
            src="/about-image-2.jpg"
            alt="A household manager at a desk with a weekly staff and vendor schedule, a family calendar, and a daily errands list."
            width={1200}
            height={758}
            className="w-full h-auto rounded-xl3 border border-cardBorder shadow-card mt-2"
          />
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
