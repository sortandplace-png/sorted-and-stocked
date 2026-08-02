// app/services/page.tsx
// Public marketing page. Copy pasted verbatim from the SEO content package,
// not rewritten or shortened. Same visual family as the homepage's service
// bento cards (Pin, icon circle, denim title, dusk body) so this reads as
// a sibling page, not a different site.
import type { Metadata } from 'next';
import { Home, ChefHat, Users, HeartHandshake, Sparkles, RotateCw, Boxes } from 'lucide-react';
import Pin from '@/components/PinAccent';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LocalBusinessJsonLd from '@/components/marketing/LocalBusinessJsonLd';

// SEO extended for the Moving service (SS-488 amendment): packing,
// unpacking, and move-in setup terms live in the metadata and the
// OfferCatalog JSON-LD below, phrased naturally. Nothing keyword-stuffed
// appears in the visible page copy.
export const metadata: Metadata = {
  title: 'Our Services | Sort + Place. Home Organization, Household Management, Moving & Packing',
  description:
    'Full-home organization, kitchen and pantry setup, staff management, newlywed packages, and packing and unpacking services with complete move-in setup. Systems that work for real families. Serving Lakewood NJ.',
  keywords: [
    'home organization Lakewood NJ',
    'household management',
    'packing services',
    'unpacking services',
    'move-in setup',
    'home organization after moving',
    'kosher kitchen organization',
  ],
  openGraph: {
    title: 'Our Services | Sort + Place. Home Organization, Household Management, Moving & Packing',
    description:
      'Full-home organization, kitchen and pantry setup, staff management, newlywed packages, and packing and unpacking services with complete move-in setup. Systems that work for real families. Serving Lakewood NJ.',
    url: 'https://sortandplace.com/services',
    type: 'website',
  },
};

// SS-488 (Option 1): every card carries a banner slot. bannerSrc is the
// per-card config Racquel fills with her REAL photos as she supplies them
// (intended assignments noted per card) -- until then the slot renders
// the Concept B placeholder gradient, never a stock or fabricated photo
// (R18/no-invented-imagery).
const SERVICES: {
  icon: typeof Home;
  title: string;
  body: string;
  bannerSrc: string | null;
}[] = [
  {
    icon: Home,
    title: 'Full Home Organization',
    body: 'Every room, every closet, every drawer. We build systems that match how your family actually lives. Labeled, sourced, and maintainable without us.',
    bannerSrc: null, // Racquel: flat-lay photo
  },
  {
    icon: ChefHat,
    title: 'Kitchen & Pantry Setup',
    body: 'Kosher kitchen flow, labeled storage, expiration tracking, and a stocked pantry that staff can maintain on their own. Fleishig, milchig, pareve, everything in its place.',
    bannerSrc: null, // Racquel: fridge photo
  },
  {
    icon: Users,
    title: 'Household Operations & Staff Management',
    body: 'Task systems, daily checklists, bilingual SOPs, shift handover protocols, and accountability tools so your home runs whether you’re there or not.',
    bannerSrc: null, // Racquel: TBD
  },
  {
    icon: HeartHandshake,
    title: 'Newlywed Package',
    body: 'Setting up your first home right: kitchen essentials, closet systems, pantry stocking, and the organizational foundation that saves arguments later.',
    bannerSrc: null, // Racquel: TBD
  },
  {
    icon: Sparkles,
    title: 'Pesach Prep',
    body: 'Full Pesach kitchen turnover, covering, labeling, inventory of Pesach supplies, and a system your staff can follow every year without retraining.',
    bannerSrc: null, // Racquel: pantry photo
  },
  {
    icon: RotateCw,
    title: 'Ongoing Management',
    body: 'Weekly meal planning, grocery ordering, vendor coordination, inventory monitoring, and regular check-ins. The invisible work that keeps everything running.',
    bannerSrc: null, // Racquel: TBD
  },
  {
    // SS-488 amendment: ADDED as a new service, nothing replaced. Copy is
    // Racquel-approved verbatim, dash-free per the copy ruling. ES
    // translation (usted register) is staged below for the day the
    // marketing site gains a locale path -- these public pages render
    // EN-only today, so there is nowhere to mount it yet:
    //   "Mudanza, Empaque y Desempaque" / "Empaque profesional antes de
    //   la mudanza, desempaque completo despues, y cada cocina, armario y
    //   cuarto de juegos listo para funcionar desde el primer dia. Sin un
    //   garaje de cajas del que usted sigue viviendo seis meses despues."
    icon: Boxes,
    title: 'Moving, Packing & Unpacking',
    body: 'Professional packing before the move, full unpacking after, and every kitchen, closet, and playroom set up to function from day one. No garage of boxes you are still living out of in six months.',
    bannerSrc: null, // Racquel: TBD
  },
];

// OfferCatalog JSON-LD: one Service entry per card, driven off the same
// SERVICES array so schema and page can't drift. The Moving entry carries
// the move-related serviceType terms (packing services, unpacking
// services, move-in setup, home organization after moving) -- crawler
// vocabulary only, never visible copy.
const SERVICES_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'OfferCatalog',
  name: 'Sort + Place Services',
  itemListElement: SERVICES.map((s) => ({
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: s.title,
      description: s.body,
      provider: { '@type': 'LocalBusiness', name: 'Sort + Place' },
      areaServed: 'Lakewood NJ',
      ...(s.title === 'Moving, Packing & Unpacking'
        ? {
            serviceType: [
              'Packing services',
              'Unpacking services',
              'Move-in setup',
              'Home organization after moving',
            ],
          }
        : {}),
    },
  })),
};

export default function ServicesPage() {
  return (
    <div className="bg-linen min-h-screen font-interDisplay">
      <LocalBusinessJsonLd />
      <script
        type="application/ld+json"
        // JSON.stringify of literals we control -- no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICES_JSONLD) }}
      />
      <MarketingHeader />

      <div className="max-w-[1100px] mx-auto px-4">
        <section className="py-14 md:py-20 text-center max-w-[720px] mx-auto">
          <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-4">
            Our Services
          </h1>
          <p className="text-lg text-dusk">
            Systems that work for real families. Not a one-time reset, a way of running the house.
          </p>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="grid md:grid-cols-2 gap-5">
            {SERVICES.map(({ icon: Icon, title, body, bannerSrc }) => (
              <div
                key={title}
                className="relative bg-card border border-cardBorder rounded-2xl shadow-card overflow-hidden"
              >
                <Pin size="sm" />
                {/* SS-488 banner slot: 140px, 16:9-framed via object-cover
                    when a real photo is configured; the Concept B gradient
                    (mist -> linen -> brass wash) stands in until Racquel
                    supplies each image -- never a stock photo. */}
                {bannerSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bannerSrc} alt="" className="w-full h-[140px] object-cover" />
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
                  <h2 className="font-display font-bold text-xl text-denim mb-2">{title}</h2>
                  <p className="text-sm text-dusk leading-relaxed">{body}</p>
                </div>
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
