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
// COPY RULE (Racquel, 2 Aug, applies to every user-facing marketing/site
// string, EN and ES): NO dashes as punctuation -- no "--", no em dash, no
// en dash in visible copy. Rewrite with periods or commas. Hyphenated
// compound words (move-in, before-and-after) stay. Code comments are
// exempt (they are not user-facing).
//
// Host-based branching (added same day, before this ever shipped): this
// page must NOT render on app.sortandplace.com -- that hostname is the real
// app, once the subdomain split is live, and needs the old redirect-to-
// /properties behavior back. Checked via the Host header rather than
// NEXT_PUBLIC_SITE_URL or similar, since the same deployment serves both
// hostnames. Deliberately an ALLOW-list of exactly one hostname (app.*)
// that redirects, with everything else (www, bare apex, localhost, Vercel
// preview URLs) falling through to marketing. The apex DOES redirect to
// www at the Vercel domain layer: the project's Domains panel shows
// "sortandplace.com -- Redirects to www.sortandplace.com" in plain text.
// TRUST THIS OVER ANY FETCH-BASED CHECK. A redirect-following client
// (curl default, pg_net, a browser) lands on www's 200 and reports the
// apex as serving directly -- byte-identical bodies on "both" hosts are
// exactly what a platform redirect produces, not evidence against one.
// Two independent investigations (3 Aug) both made that inference, this
// comment was "corrected" to match, and an app-level www->apex 308 built
// on that reading put BOTH hosts in a redirect loop for ~15 minutes
// (SS-578). Racquel has ruled the apex canonical; the pending fix is
// flipping the Domains panel (primary = apex), never an app-level
// redirect while the platform points the other way.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import Pin from '@/components/PinAccent';
import ConsultationForm from '@/components/ConsultationForm';
import { ClipboardList, Users, Package } from 'lucide-react';
import { TESTFLIGHT_URL } from '@/lib/testflight';
import { APP_HOSTNAME } from '@/lib/site-url';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';
import { CANONICAL_ORIGIN } from '@/lib/site-url';

// Exact copy from the SEO content package, pasted verbatim per the brief --
// title/description differ from what shipped earlier tonight (that version
// predates having the actual content package; this is the real, final copy).
export const metadata: Metadata = {
  // SS-578: canonical is the apex, one address per page whichever host serves it.
  alternates: { canonical: `${CANONICAL_ORIGIN}` },
  title: 'Sort + Place | Professional Home Organization & Household Management, Lakewood NJ',
  description:
    'Sort + Place brings order to busy homes. Professional organization, household staff management, and meal planning systems built to last, not just for the after photo. Serving Lakewood NJ and Ocean County.',
  openGraph: {
    title: 'Sort + Place | Professional Home Organization & Household Management, Lakewood NJ',
    description:
      'Sort + Place brings order to busy homes. Professional organization, household staff management, and meal planning systems built to last, not just for the after photo. Serving Lakewood NJ and Ocean County.',
    url: 'https://sortandplace.com',
    type: 'website',
  },
};

// Banners (2 Aug midnight batch): Racquel's real photos, optimized into
// public/services/ at 1200x675 (16:9) and rendered through next/image --
// NOT Supabase render transforms (SS-451). Never stock imagery (R18).
const SERVICES = [
  {
    icon: ClipboardList,
    title: 'Weekly Meal Planning + Grocery Orders Placed',
    body: 'A real plan for the week, and the order actually placed. Not just a list you still have to shop yourself.',
    bannerSrc: '/services/meal-planning.jpg', // Organized_refrigerator (1128 version, ruled)
  },
  {
    icon: Users,
    title: 'Vendor Scheduling',
    body: 'Cleaners, handyman, simcha help. Coordinated and confirmed, so it is off your plate and actually on the calendar.',
    // SS-572: the photo this card carried (vendor-scheduling.jpg,
    // "Desk_planning_with_planner") is an open notebook whose pages are
    // LEGIBLE AT DISPLAY SIZE and read out internal staff procedure --
    // including "[SOP] Security Procedures / Procedimientos de Seguridad:
    // Verify all perimeter access is locked" -- on the public homepage.
    // Same photograph as the one pulled from blog-03 (SS-566), a second
    // copy under a different filename and crop. All ten OTHER service
    // banners were read at magnification in the same pass and are clean.
    // bannerSrc stays null until Racquel supplies a replacement; the ruled
    // Concept B gradient stands in, as on /services (SS-488).
    bannerSrc: null as string | null,
  },
  {
    icon: Package,
    title: 'Systems That Stick',
    body: 'Closets, playrooms, papers, pantries. Built to hold up under a real, busy household, not just for the after photo.',
    bannerSrc: '/services/systems-that-stick.jpg', // Walk-in_pantry
  },
  // Moving and Simcha were briefly cards here too -- RULED OFF the
  // homepage (Racquel, 2 Aug, from her screenshots): they live on
  // /services only. The homepage keeps its original three cards; both
  // consultation forms and the API allowlist still carry all services.
];

export default async function RootMarketingPage() {
  const headersList = await headers();
  const hostname = (headersList.get('host') ?? '').split(':')[0].toLowerCase();
  if (hostname === APP_HOSTNAME) {
    redirect('/properties');
  }

  return (
    <div className="bg-mist min-h-screen flex flex-col font-interDisplay">
      <LocalBusinessJsonLd />

      {/* The top contact strip is GONE entirely (2 Aug ruling) -- first it
          lost its phone numbers (SS-454/SS-434), then the email-only band
          itself was removed. Email lives in the footer and on /contact
          only. The if-any-number-then-both parity rule stays recorded
          should numbers ever be ruled back anywhere. */}
      <MarketingHeader />

      <div className="max-w-[1080px] mx-auto px-4">
        {/* Hero */}
        <section className="py-14 md:py-20 text-center max-w-[820px] mx-auto">
          <h1 className="font-display font-bold text-4xl md:text-6xl text-denim leading-[1.08] mb-6">
            {/* SS-531: non-breaking space binds "pretty pantry" so the line
                never breaks between them. Deliberately NOT text-balance --
                that would rewrap the whole headline at every width and this
                is a fix for one specific break, not a layout change. */}
            You don&apos;t need another pretty&nbsp;pantry. You need someone to run the backend of your home.
          </h1>
          <p className="text-lg text-dusk mb-9">We take the mental load off your plate.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#consultation"
              className="bg-denim text-white font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
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
              href={TESTFLIGHT_URL}
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
            {SERVICES.map(({ icon: Icon, title, body, bannerSrc }) => (
              <div
                key={title}
                className="relative bg-card border border-cardBorder rounded-2xl shadow-card overflow-hidden"
              >
                <Pin size="sm" />
                {bannerSrc ? (
                  <Image
                    src={bannerSrc}
                    alt=""
                    width={1200}
                    height={675}
                    className="w-full h-[140px] object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-[140px]"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, #E8EEF6 0%, #FFFAF3 62%, rgba(198,164,110,0.28) 100%)',
                    }}
                    aria-hidden="true"
                  />
                )}
                <div className="p-6">
                  <div className="w-11 h-11 rounded-full bg-brass/15 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-brass" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-denim mb-2">{title}</h3>
                  <p className="text-sm text-dusk leading-relaxed">{body}</p>
                </div>
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

      </div>

      <MarketingFooter homepage extraLinks={[{ href: '/terms.html', label: 'Terms' }]} />
    </div>
  );
}
