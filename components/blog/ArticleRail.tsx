// components/blog/ArticleRail.tsx
// The persistent article rail. Right side, ~240px, sticky.
//
// WHY THIS EXISTS AT ALL: SS-665's complaint was a 15rem EMPTY gutter, not
// the existence of a margin. A margin only earns its space if something
// lives in it. This is what lives in it.
//
// ORDER IS THE RULING: search, printables, subscribe, recent posts,
// categories. Not by weight, not alphabetical.
//
// BELOW 900px IT COLLAPSES BENEATH THE ARTICLE, never above it. Above puts
// the email ask before the reader has seen a word, which is exactly what
// SS-639 removed from the index. Achieved with flex order rather than a
// second copy of the markup: two copies is how they drift.
import Link from 'next/link';
import SubscribeForm from '@/components/blog/SubscribeForm';
import { createClient } from '@/lib/supabase/server';

// Free printables. These are the PUBLIC stubs in public/downloads, which
// stay free by ruling; the gated designed set (SS-686) is reached only
// through a signed download link in the welcome email and must never be
// listed here.
//
// A SHORT CURATED LIST, NOT ALL 24, and not a database read: there is no
// printables table, and inventing one was not in scope. Two across at
// ~240px is the constraint, so four is the honest maximum before the rail
// becomes a directory. FLAGGED: when a printables table exists this should
// read from it, because a hardcoded list is exactly the kind of thing that
// rots quietly.
const RAIL_PRINTABLES: { file: string; en: string; es: string }[] = [
  { file: 'pantry-organization-checklist.pdf', en: 'Pantry Checklist', es: 'Lista de despensa' },
  { file: 'household-systems-planner.pdf', en: 'Systems Planner', es: 'Planificador de sistemas' },
  { file: 'home-inventory-starter-guide.pdf', en: 'Inventory Starter', es: 'Guía de inventario' },
  { file: 'weekly-cleaning-schedule.pdf', en: 'Weekly Schedule', es: 'Horario semanal' },
];

const COPY = {
  en: {
    search: 'Search the blog',
    searchPlaceholder: 'Search',
    printables: 'Free printables',
    follow: 'Follow along',
    followLine: 'New posts by email, when we publish them. No more than that.',
    recent: 'Recent posts',
    categories: 'Categories',
  },
  es: {
    search: 'Buscar en el blog',
    searchPlaceholder: 'Buscar',
    printables: 'Imprimibles gratuitos',
    follow: 'Sigue el blog',
    followLine: 'Publicaciones nuevas por correo, cuando las publicamos. Nada más.',
    recent: 'Publicaciones recientes',
    categories: 'Categorías',
  },
} as const;

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brass mb-2.5">
      {children}
    </p>
  );
}

export default async function ArticleRail({
  locale,
  currentSlug,
}: {
  locale: 'en' | 'es';
  /** Excluded from Recent, so the rail never offers the page you are on. */
  currentSlug?: string;
}) {
  const c = COPY[locale];
  const supabase = await createClient();

  // Four, so that excluding the current post still leaves three.
  const { data: recentRaw } = await supabase
    .from('blog_posts')
    .select('slug, title, header_image_url, published_at')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(4);

  const recent = (recentRaw ?? []).filter((p) => p.slug !== currentSlug).slice(0, 3);

  const { data: categories } = await supabase
    .from('blog_categories')
    .select('slug, label_en, label_es')
    .order('sort_order');

  return (
    <aside
      className="w-full min-[900px]:w-[240px] min-[900px]:shrink-0 min-[900px]:sticky min-[900px]:top-24 min-[900px]:self-start space-y-7"
      aria-label={locale === 'es' ? 'Barra lateral del blog' : 'Blog sidebar'}
    >
      {/* SEARCH. A GET form to the index, so it works with JavaScript off
          and a result page is a real, shareable URL. */}
      <div>
        <RailHeading>{c.search}</RailHeading>
        <form action="/blog" method="get" role="search">
          <label htmlFor="rail-q" className="sr-only">
            {c.search}
          </label>
          <input
            id="rail-q"
            name="q"
            type="search"
            placeholder={c.searchPlaceholder}
            className="w-full bg-card border border-cardBorder rounded-xl2 px-3 py-2 text-[13px] text-denim placeholder:text-denim/40 focus:outline-none focus:ring-1 focus:ring-denim/40"
          />
        </form>
      </div>

      {/* PRINTABLES, TWO ACROSS, LETTER PORTRAIT. Three across 240px is
          60px each and unrecognisable as a document. aspect ratio 8.5/11
          so the thumbnails read as paper rather than as tiles. */}
      <div>
        <RailHeading>{c.printables}</RailHeading>
        <ul className="grid grid-cols-2 gap-2.5">
          {RAIL_PRINTABLES.map((p) => (
            <li key={p.file}>
              <a
                href={`/downloads/${p.file}`}
                className="block group"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="block aspect-[8.5/11] rounded-lg border border-cardBorder bg-card group-hover:border-brass transition-colors" />
                <span className="block mt-1.5 text-[11px] leading-snug text-denim group-hover:text-brass transition-colors">
                  {locale === 'es' ? p.es : p.en}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* SUBSCRIBE. THE EXISTING COMPONENT. Never a second form: it carries
          the honeypot, the timing check, the IP rate limit, the dedupe, the
          locale and the signed token flow, and a copy would carry none of
          them. bare drops its own top rule, which the rail's spacing
          already provides. */}
      <div>
        <RailHeading>{c.follow}</RailHeading>
        <SubscribeForm variant="inline" bare source="blog-rail" line={c.followLine} />
      </div>

      {recent.length > 0 && (
        <div>
          <RailHeading>{c.recent}</RailHeading>
          <ul className="space-y-3">
            {recent.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="flex gap-2.5 items-start group">
                  {p.header_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.header_image_url}
                      alt=""
                      loading="lazy"
                      className="w-11 h-11 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="w-11 h-11 shrink-0 rounded-lg bg-mist" />
                  )}
                  <span className="text-[12px] leading-snug text-denim group-hover:text-brass transition-colors">
                    {p.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {categories && categories.length > 0 && (
        <div>
          <RailHeading>{c.categories}</RailHeading>
          {/* The index is the PRIMARY home for these; the rail is
              secondary, so each is a link into the index's own filter
              rather than a second filtering mechanism living here. */}
          <ul className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/blog?category=${cat.slug}`}
                  className="inline-block rounded-full border border-cardBorder px-2.5 py-1 text-[11px] text-denim hover:border-brass hover:text-brass transition-colors"
                >
                  {locale === 'es' ? cat.label_es : cat.label_en}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
