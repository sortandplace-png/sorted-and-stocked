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
    <div className="bg-linen min-h-screen font-interDisplay">
      <LocalBusinessJsonLd />
      <MarketingHeader />

      <div className="max-w-[520px] mx-auto px-4 py-14 md:py-20">
        <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-3 text-center">
          Book Your Consultation
        </h1>
        <p className="text-lg text-dusk mb-10 text-center">
          Tell us a bit about your household, and we&apos;ll be in touch to set up a conversation.
        </p>

        <ContactPageForm />

        <p className="mt-10 text-sm text-dusk text-center">
          Prefer to call?{' '}
          <a href="tel:+17189384342" className="text-denim hover:text-brass transition-colors">
            (718) 938-4342
          </a>
        </p>
      </div>

      <MarketingFooter />
    </div>
  );
}
