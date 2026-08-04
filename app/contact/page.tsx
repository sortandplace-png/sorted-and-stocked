// app/contact/page.tsx
// Public marketing page.
import type { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';
import ContactPageForm from '@/components/marketing/ContactPageForm';
import Pin from '@/components/PinAccent';
import { CANONICAL_ORIGIN } from '@/lib/site-url';

export const metadata: Metadata = {
  // SS-578: canonical is the apex, one address per page whichever host serves it.
  alternates: { canonical: `${CANONICAL_ORIGIN}/contact` },
  title: 'Contact Us | Sort + Place',
  description: 'Ready to bring order to your home? Book a consultation with Sort + Place. Serving Lakewood NJ and Ocean County.',
  openGraph: {
    title: 'Contact Us | Sort + Place',
    description: 'Ready to bring order to your home? Book a consultation with Sort + Place. Serving Lakewood NJ and Ocean County.',
    url: 'https://sortandplace.com/contact',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    // No min-h-screen here (2 Aug, second report of the footer gap): on a
    // short page a viewport-height floor plus this page's own bottom
    // padding plus the footer's default top margin stacked into ~180px of
    // dead linen between the submit button and the footer hairline. The
    // content column keeps its top padding but ends tight (pb-8).
    // The footer's own mt-16 was removed globally on the fourth report --
    // this page no longer needs a special prop, because no page does.
    <div className="bg-linen font-interDisplay min-h-screen flex flex-col">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[520px] mx-auto px-4 pt-14 md:pt-20 pb-8">
        <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-3 text-center">
          Book Your Consultation
        </h1>
        <p className="text-lg text-dusk mb-10 text-center">
          Tell us a bit about your household, and we&apos;ll be in touch to set up a conversation.
        </p>

        {/* SS-633: the form had no card and therefore no pin dot, which
            the design record requires on every card without exception.
            Page stays linen, card is #FFFEFC on top of it, so the
            hierarchy reads page -> card -> fields. The fields keep their
            own cardBorder outline, so they stay legible against a card
            of the same value. */}
        <div className="relative bg-card border border-cardBorder rounded-xl3 shadow-card p-6">
          <Pin />
          <ContactPageForm />
        </div>

        {/* SS-454/SS-434: email only -- the "Prefer to call?" line and its
            number are gone on the site-wide zero-numbers ruling. */}
        <p className="mt-10 text-sm text-dusk text-center">
          Prefer email?{' '}
          <a href="mailto:SortandPlace@gmail.com" className="text-denim hover:text-brass transition-colors">
            SortandPlace@gmail.com
          </a>
        </p>
      </div>

      <MarketingFooter />
    </div>
  );
}
