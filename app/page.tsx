// app/page.tsx
// Public marketing landing page for Sort + Place's organizing/household-
// management service (the root domain, sortandplace.com) -- distinct from
// app/welcome/page.tsx, which is the Sorted & Stocked *software* product's
// own early-access page. "Client Portal" below routes to /login, not
// /welcome -- /welcome is a different marketing page with no path back to
// sign-in, confirmed by reading its actual content before wiring anything
// to it, per the original ask.
//
// 2026-07-21: root used to hard-redirect to /properties (see middleware.ts's
// PUBLIC_PATHS, which had to be updated in the same change for this page to
// actually be reachable by a signed-out visitor -- see that file's comment
// for why the root path specifically needs an exact-match, not startsWith,
// check).
//
// Host-based branching (added same day, before this ever shipped): this
// page must NOT render on app.sortandplace.com -- that hostname is the real
// app, once the subdomain split is live, and needs the old redirect-to-
// /properties behavior back. Checked via the Host header rather than
// NEXT_PUBLIC_SITE_URL or similar, since the same deployment serves both
// hostnames. Deliberately an ALLOW-list of exactly one hostname (app.*)
// that redirects, with everything else (www, bare apex, localhost, Vercel
// preview URLs) falling through to marketing -- not a check for the bare
// apex specifically, which would never fire for a real visitor (apex 308s
// to www at the DNS/hosting layer, outside this repo, before Next.js ever
// sees the request).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Pin from '@/components/PinAccent';
import ConsultationForm from '@/components/ConsultationForm';
import { ClipboardList, Users, Package } from 'lucide-react';

const APP_HOSTNAME = 'app.sortandplace.com';

export const metadata: Metadata = {
  title: 'Sort & Place | Professional Home Organization & Household Management',
  description:
    'Sort + Place runs the backend of your home -- weekly meal planning and grocery orders, vendor scheduling, and systems that actually stick. Book a consultation.',
  openGraph: {
    title: 'Sort & Place | Professional Home Organization & Household Management',
    description:
      'We take the mental load off your plate -- meal planning, grocery orders, vendor scheduling, and systems that stick.',
    url: 'https://sortandplace.com',
    type: 'website',
  },
};

const SERVICES = [
  {
    icon: ClipboardList,
    title: 'Weekly Meal Planning + Grocery Orders Placed',
    body: 'A real plan for the week, and the order actually placed -- not just a list you still have to shop yourself.',
  },
  {
    icon: Users,
    title: 'Vendor Scheduling',
    body: 'Cleaners, handyman, simcha help -- coordinated and confirmed, so it is off your plate and actually on the calendar.',
  },
  {
    icon: Package,
    title: 'Systems That Stick',
    body: 'Closets, playrooms, papers, pantries -- built to hold up under a real, busy household, not just for the after photo.',
  },
];

export default async function RootMarketingPage() {
  const headersList = await headers();
  const hostname = (headersList.get('host') ?? '').split(':')[0].toLowerCase();
  if (hostname === APP_HOSTNAME) {
    redirect('/properties');
  }

  return (
    <div className="bg-mist min-h-screen font-interDisplay">
      {/* Contact bar */}
      <div className="bg-denim text-white text-xs text-center py-2 px-4">
        <a href="tel:+17189384342" className="hover:underline">
          (718) 938-4342
        </a>
        <span className="mx-2 text-white/50" aria-hidden="true">
          ·
        </span>
        <a href="tel:+17189162518" className="hover:underline">
          (718) 916-2518
        </a>
      </div>

      <div className="max-w-[1080px] mx-auto px-4">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <span className="font-display font-bold text-2xl text-denim">Sort + Place</span>
          <a href="/login" className="text-sm font-semibold text-denim hover:text-brass transition-colors">
            Client Portal
          </a>
        </nav>

        {/* Hero */}
        <section className="py-14 md:py-20 text-center max-w-[820px] mx-auto">
          <h1 className="font-display font-bold text-4xl md:text-6xl text-denim leading-[1.08] mb-6">
            You don&apos;t need another pretty pantry. You need someone to run the backend of your home.
          </h1>
          <p className="text-lg text-dusk mb-9">We take the mental load off your plate.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#consultation"
              className="bg-brass text-denim font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
            >
              Book Your Consultation
            </a>
            <a href="/login" className="text-sm font-semibold text-denim underline decoration-cardBorder underline-offset-4 hover:text-brass">
              Client Portal
            </a>
          </div>

          {/* TestFlight. Below the CTA row so it reads as a third option
              rather than competing with the consultation booking, which is
              still the primary action on this page.

              The Apple mark is inlined. The brief asked for Tabler's
              ti-brand-apple; Tabler is not a dependency here (lucide-react
              is), and lucide's Apple icon is the fruit, not the brand. One
              path is lighter than adding an icon library for a single glyph.

              rel="noopener noreferrer" because this opens a new tab to an
              external host -- without it the opened page gets a handle back
              to this one through window.opener.

              The word "beta" appears nowhere, per the brief. */}
          <div className="mt-6 flex flex-col items-center">
            <a
              href="https://testflight.apple.com/join/n5gZbpa5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 border-2 border-denim text-denim font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:bg-denim hover:text-white transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="currentColor"
                aria-hidden="true"
                className="shrink-0"
              >
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Get Early Access
            </a>
            <p className="mt-2.5 text-xs text-dusk">iPhone only · Requires TestFlight app</p>
          </div>
        </section>

        {/* Service bento cards */}
        <section className="py-10 md:py-14">
          <div className="grid md:grid-cols-3 gap-5">
            {SERVICES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="relative bg-card border border-cardBorder rounded-2xl shadow-card p-6"
              >
                <Pin size="sm" />
                <div className="w-11 h-11 rounded-full bg-brass/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brass" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold text-xl text-denim mb-2">{title}</h3>
                <p className="text-sm text-dusk leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Accent banner */}
      <section className="bg-denim py-12 px-4">
        <div className="max-w-[720px] mx-auto text-center">
          <p className="text-white text-base md:text-lg leading-relaxed">
            Think of us like a house manager for your inside thoughts, not just your shelves. We do the invisible
            work that keeps life moving, so you get back time, clarity, and breathing room.
          </p>
        </div>
      </section>

      <div className="max-w-[1080px] mx-auto px-4">
        {/* Consultation intake */}
        <section id="consultation" className="py-14 md:py-20">
          <div className="max-w-[560px] mx-auto text-center">
            <h2 className="font-display font-bold text-3xl text-denim mb-3">Book Your Consultation</h2>
            <p className="text-sm text-dusk mb-8">
              Tell us a bit about your household, and we&apos;ll be in touch to set up a conversation.
            </p>
            <ConsultationForm />
          </div>
        </section>

        <footer className="border-t border-cardBorder py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-dusk">
          <span>© Sort + Place. All rights reserved.</span>
          <span className="flex gap-4">
            <a href="/privacy.html" className="hover:text-denim">
              Privacy
            </a>
            <a href="/terms.html" className="hover:text-denim">
              Terms
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
