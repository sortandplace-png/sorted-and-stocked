// app/services/page.tsx
// Public marketing page. Copy pasted verbatim from the SEO content package,
// not rewritten or shortened. Same visual family as the homepage's service
// bento cards (Pin, icon circle, denim title, dusk body) so this reads as
// a sibling page, not a different site.
import type { Metadata } from 'next';
import Image from 'next/image';
import { Home, ChefHat, Users, HeartHandshake, Sparkles, RotateCw, Boxes, PartyPopper } from 'lucide-react';
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
// 2 Aug midnight batch: five of Racquel's real photos landed (optimized to
// 1200x675 in public/services/, rendered via next/image -- NOT Supabase
// transforms, SS-451). 2 Aug evening: her servicecardimages drop filled the
// last three empty slots and replaced Moving + Simcha per her consolidated
// fix list -- every card now carries a real supplied image, none of them
// invented (R18 intact).
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
    bannerSrc: '/services/full-home-organization.jpg', // Racquel's servicecardimages drop, 2 Aug
  },
  {
    icon: ChefHat,
    title: 'Kitchen & Pantry Setup',
    body: 'Kosher kitchen flow, labeled storage, expiration tracking, and a stocked pantry that staff can maintain on their own. Fleishig, milchig, pareve, everything in its place.',
    bannerSrc: '/services/kitchen-pantry-setup.jpg', // Racquel's servicecardimages drop, 2 Aug
  },
  {
    icon: Users,
    title: 'Household Operations & Staff Management',
    body: 'Task systems, daily checklists, bilingual SOPs, shift handover protocols, and accountability tools so your home runs whether you’re there or not.',
    bannerSrc: '/services/household-operations.jpg', // Racquel's servicecardimages drop, 2 Aug
  },
  {
    icon: HeartHandshake,
    title: 'Newlywed Package',
    body: 'Setting up your first home right: kitchen essentials, closet systems, pantry stocking, and the organizational foundation that saves arguments later.',
    bannerSrc: '/services/newlywed-package.jpg', // Pantry_being_organized_with_containers
  },
  {
    icon: Sparkles,
    title: 'Pesach Prep',
    body: 'Full Pesach kitchen turnover, covering, labeling, inventory of Pesach supplies, and a system your staff can follow every year without retraining.',
    bannerSrc: '/services/pesach-prep.jpg', // Kosher_kitchen_prepared_for_Pesach
  },
  {
    icon: RotateCw,
    title: 'Ongoing Management',
    body: 'Weekly meal planning, grocery ordering, vendor coordination, inventory monitoring, and regular check-ins. The invisible work that keeps everything running.',
    bannerSrc: '/services/ongoing-management.jpg', // Luxury_home_management_workspace
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
    bannerSrc: '/services/moving-packing-unpacking.jpg', // replaced with Racquel's servicecardimages drop, 2 Aug (was Moving_boxes_in_luxury_home)
  },
  {
    // 2 Aug ruling: sixth service (eighth card here), ADDED like Moving.
    // Copy verbatim, dash-free. Brings this grid to 8 cards -- four even
    // 2-up rows, per the even-counts rebalance ruling. ES (usted) staged
    // like Moving's, same no-locale-path caveat:
    //   "Preparacion de Simjas y Eventos" / "La casa lista para recibir
    //   invitados antes de la simja y ordenada de nuevo despues. Ayuda
    //   extra programada, la ropa de cama contada, y la cocina lista de
    //   nuevo mientras usted disfruta del evento."
    icon: PartyPopper,
    title: 'Simcha & Event Prep',
    body: 'The house guest ready before the simcha and put back together after. Extra hands scheduled, linens counted, and the kitchen turned around while you enjoy the event.',
    bannerSrc: '/services/simcha-event-prep.jpg', // replaced with Racquel's servicecardimages drop, 2 Aug (was Dining_room_prepared_for_celebration)
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
    <div className="bg-linen min-h-screen flex flex-col font-interDisplay">
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
            className="inline-block bg-denim text-white font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-card"
          >
            Book Your Consultation
          </a>
        </section>
      </div>

      <MarketingFooter />
    </div>
  );
}
