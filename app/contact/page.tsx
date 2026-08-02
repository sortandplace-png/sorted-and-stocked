// app/contact/page.tsx
// Public marketing page.
import type { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';
import ContactPageForm from '@/components/marketing/ContactPageForm';

export const metadata: Metadata = {
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
    <div className="bg-linen font-interDisplay">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[520px] mx-auto px-4 pt-14 md:pt-20 pb-8">
        <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-3 text-center">
          Book Your Consultation
        </h1>
        <p className="text-lg text-dusk mb-10 text-center">
          Tell us a bit about your household, and we&apos;ll be in touch to set up a conversation.
        </p>

        <ContactPageForm />

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
