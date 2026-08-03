// app/welcome/page.tsx
// Public marketing landing page for the Sorted & Stocked product. Lives at
// /welcome, NOT at the app's real root ("/") -- app/page.tsx serves the
// Sort + Place marketing homepage (with a Host-header redirect for
// app.sortandplace.com), and stays that way.
//
// Concept B (Racquel ruling, 2 Aug: "Concept B is universal. That page and
// every other one.") -- this page originally shipped on the Bold Direction
// mockup palette; every token here is now the canonical Concept B set from
// tailwind.config.ts. The kashrut chips use the functional triple
// rust/dairy/sage EXACTLY as defined -- no opacity, blend, or tint on top
// (never-restyle rule).
import type { Metadata } from 'next';
import { CalendarDays, Package, ShoppingCart, Users } from 'lucide-react';
import RequestAccessForm from '@/components/RequestAccessForm';
import { CANONICAL_ORIGIN } from '@/lib/site-url';

export const metadata: Metadata = {
  // SS-578: canonical is the apex, one address per page whichever host serves it.
  alternates: { canonical: `${CANONICAL_ORIGIN}/welcome` },
  title: 'Sorted & Stocked. Built for the way your kitchen actually runs',
  description:
    'Meal planning, inventory, and staff coordination built for Orthodox Jewish households. Kashrut-aware from day one, by a professional organizer.',
  openGraph: {
    title: 'Sorted & Stocked. Built for the way your kitchen actually runs',
    description: 'Meal planning, inventory, and staff coordination that actually understands kashrut, Shabbos, and Yom Tov.',
    url: 'https://sortandplace.com/welcome',
    type: 'website',
  },
};

// Brass (#C6A46E) house mark -- the Bold-era gold #C5A46D was one digit off
// the Concept B brass token; now the real token value.
const HOUSE_MARK = (
  <svg viewBox="0 0 100 100" aria-hidden="true" className="w-full h-full">
    <rect x="64" y="14" width="9" height="27" fill="#C6A46E" />
    <polygon points="50,8 92,44 8,44" fill="#C6A46E" />
    <rect x="20" y="44" width="60" height="45" fill="#C6A46E" />
  </svg>
);

const FEATURES = [
  { icon: CalendarDays, title: 'Meal Plan', body: 'Full year, aware of Shabbos, Yom Tov, and the Nine Days automatically.' },
  { icon: Package, title: 'Inventory', body: 'Real stock counts by zone: fridge, freezer, pantry. Not a guess.' },
  { icon: ShoppingCart, title: 'Shopping List', body: 'Built from the meal plan automatically, organized by aisle for real trips.' },
  { icon: Users, title: 'Staff Coordination', body: 'Real shift handover and task tracking. Searchable, not lost in a chat.' },
];

export default function WelcomePage() {
  return (
    <div className="bg-linen py-8 px-4">
      <div className="max-w-[1080px] mx-auto">
        <nav className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-lg bg-denim overflow-hidden">{HOUSE_MARK}</div>
            <span className="font-display font-bold text-xl text-denim">Sorted &amp; Stocked</span>
          </div>
          <a href="#cta" className="text-[12.5px] font-extrabold tracking-wide bg-denim text-white px-5 py-2.5 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity">
            Request Early Access
          </a>
        </nav>

        <section className="grid md:grid-cols-2 gap-10 items-center py-12">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase font-bold text-brass border-b border-brass inline-block pb-1 mb-4">
              For Orthodox Households
            </p>
            <h1 className="font-display font-bold text-4xl md:text-5xl text-denim leading-[1.1] mb-5">
              Built for the way your kitchen actually runs.
            </h1>
            <p className="text-dusk text-base leading-relaxed max-w-[460px] mb-7">
              Meal planning, inventory, and staff coordination that actually understands kashrut, Shabbos, and Yom
              Tov. Built by a professional organizer, not retrofitted from a generic recipe app.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <a href="#cta" className="bg-denim text-white font-bold text-sm px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity">
                Request Early Access
              </a>
              <a href="#signature" className="font-bold text-sm text-denim underline decoration-cardBorder underline-offset-4 hover:text-brass">
                See how it works →
              </a>
            </div>
          </div>

          {/* Demo card. FICTIONAL menu only -- the original mockup shipped
              with a real family's meal_plan_entries for 2026-07-12 baked
              into this public page (caught 2 Aug, Racquel's privacy audit).
              These dish names are invented and verified absent from the
              recipes table; the date is deliberately not any planned date.
              Never paste real plan data here. */}
          <div className="bg-denim rounded-xl3 p-6 shadow-card">
            <p className="font-display font-semibold text-xl text-brass mb-4">Sunday · Mar 8</p>
            {[
              { tag: 'Fleishig', bg: 'bg-rust', course: 'Soup', name: 'Golden Chicken Soup' },
              { tag: 'Fleishig', bg: 'bg-rust', course: 'Protein', name: 'Herb Roasted Chicken' },
              { tag: 'Parve', bg: 'bg-sage', course: 'Starch', name: 'Crispy Roasted Potatoes' },
              { tag: 'Parve', bg: 'bg-sage', course: 'Vege', name: 'Green Beans Almondine' },
            ].map((row, i) => (
              <div key={i} className={`flex items-start gap-3 py-2.5 ${i > 0 ? 'border-t border-white/10' : ''}`}>
                <span className={`shrink-0 mt-0.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase text-white ${row.bg}`}>
                  {row.tag}
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{row.course}</p>
                  <p className="font-display font-semibold text-base text-white">{row.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14">
          <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-dusk mb-3.5">The Real Problem</p>
          <h2 className="font-display font-semibold text-3xl text-denim max-w-[600px] mb-4">
            You&apos;re already running this system, just in your head, and in a dozen WhatsApp threads.
          </h2>
          <p className="text-dusk text-[15px] max-w-[520px] leading-relaxed mb-9">
            Every household manager already knows what&apos;s meat, what&apos;s dairy, what&apos;s running low, and
            who&apos;s covering the next shift. It just lives nowhere anyone else can see it.
          </p>
          <div className="grid md:grid-cols-2 gap-3.5">
            {[
              ['Kashrut lives in someone’s memory', 'New staff, guests, or a busy week, and the risk of a mix-up goes way up.'],
              ['Staff coordination happens over text', 'Handover notes get lost in a chat thread nobody can search later.'],
              ['Meal planning ignores the calendar', 'Generic apps don’t know Erev Yom Tov needs a different plan than a Tuesday.'],
              ['Inventory is a guess', 'Nobody finds out the eggs ran out until they’re already cracking the shell.'],
            ].map(([title, body]) => (
              <div key={title} className="bg-card border border-cardBorder rounded-xl2 shadow-card p-5">
                <p className="font-display font-bold text-lg text-denim mb-1">{title}</p>
                <p className="text-dusk text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section id="signature" className="bg-denim py-14 -mx-4 px-4">
        <div className="max-w-[1080px] mx-auto">
          <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-brass mb-3.5">The Difference</p>
          <h2 className="font-display font-semibold text-3xl text-white mb-4">One glance. Always safe.</h2>
          <p className="text-white/80 text-[15px] max-w-[520px] leading-relaxed mb-9">
            Every recipe and every inventory item carries one of three tags, bold enough to see at a glance,
            built into the product from day one, not bolted on after.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ['Fleishig', 'bg-rust', 'Meat. Flagged red, everywhere it appears: recipes, inventory, the shopping list.'],
              ['Milchig', 'bg-dairy', 'Dairy. The system warns automatically if a meat and dairy item land on the same day.'],
              ['Parve', 'bg-sage', 'Neither. Safe with either, and the meal plan knows the difference.'],
            ].map(([title, bg, body]) => (
              <div key={title} className="border border-white/15 rounded-xl2 p-6">
                <div className={`w-full h-1.5 rounded mb-4 ${bg}`} />
                <p className="font-display font-bold text-xl text-white mb-2">{title}</p>
                <p className="text-white/70 text-[13px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1080px] mx-auto">
        <section className="py-14">
          <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-dusk mb-3.5">What&apos;s Inside</p>
          <h2 className="font-display font-semibold text-3xl text-denim mb-6">Everything a household actually runs on.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-cardBorder rounded-xl2 shadow-card p-5">
                <div className="w-[38px] h-[38px] rounded-full bg-brass/15 flex items-center justify-center mb-3.5">
                  <f.icon className="w-[18px] h-[18px] text-brass" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <p className="font-display font-bold text-[17px] text-denim mb-1.5">{f.title}</p>
                <p className="text-dusk text-[12.5px] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-[0.4fr_0.6fr] gap-11 items-center py-14 text-center md:text-left">
          <div className="w-20 h-20 rounded-2xl bg-denim overflow-hidden mx-auto md:mx-0">{HOUSE_MARK}</div>
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-dusk mb-3.5">Built By Someone Who&apos;s Done This</p>
            <h2 className="font-display font-semibold text-[26px] text-denim mb-3">
              Not a developer&apos;s guess at kosher life. A professional organizer&apos;s system.
            </h2>
            <p className="text-dusk text-[14.5px] leading-relaxed">
              Sorted &amp; Stocked comes from Sort + Place, a professional organizing practice built specifically for
              the Orthodox Jewish home. Every part of this system exists because a real household needed it first.
            </p>
          </div>
        </section>

        <section id="cta" className="bg-card border border-cardBorder rounded-xl3 shadow-card p-10 md:p-14 text-center mb-16">
          <h2 className="font-display font-semibold text-[28px] text-denim mb-3.5">Bring order to your kitchen.</h2>
          <p className="text-dusk text-[14.5px] mb-6">
            Sorted &amp; Stocked is currently working with households in Lakewood, NJ, with more coming soon.
          </p>
          <RequestAccessForm />
          <p className="text-[11.5px] text-dusk mt-4">No commitment, just a conversation about your household.</p>
        </section>

        <footer className="border-t border-cardBorder py-7 flex items-center justify-between text-xs text-dusk">
          <span>© Sorted &amp; Stocked, a Sort + Place system.</span>
          <span className="flex gap-4">
            <a href="/privacy.html" className="hover:text-denim">Privacy</a>
            <a href="/terms.html" className="hover:text-denim">Terms</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
