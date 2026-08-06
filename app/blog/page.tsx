// app/blog/page.tsx
// Public, unauthenticated -- see PUBLIC_PATHS in lib/supabase/middleware.ts.
// This is the SEO surface: seven published articles on kosher household
// management are the content that gets sortandplace.com surfacing in
// Lakewood searches, so the page gets the full marketing treatment --
// shared header/footer, real metadata, header images -- rather than the
// bare list it launched as. sitemap.xml already emits /blog and every
// published slug (app/sitemap.ts).
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { SITE_URL, CANONICAL_ORIGIN } from '@/lib/site-url';

export const metadata = {
  // SS-586: no em dashes in page chrome -- titles and meta descriptions
  // are what Google renders, the most publicly visible copy on the site.
  title: 'Blog: Kosher Household Management | Sort + Place',
  description:
    'Practical articles on kosher household management from Sort + Place in Lakewood, NJ: staff training, Shabbos and Yom Tov preparation, inventory, and multi-property care.',
  // SS-578: canonical pinned to the apex constant, not the env-overridable SITE_URL.
  alternates: { canonical: `${CANONICAL_ORIGIN}/blog` },
};

// Public content that changes whenever a post is published -- must never
// serve a stale cached list.
export const dynamic = 'force-dynamic';

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();
  const locale = await getLocale();
  const es = locale === 'es';

  const { data: categories } = await supabase
    .from('blog_categories')
    .select('slug, label_en, label_es')
    .order('sort_order');

  // The category filter reads the join, not a text column, because a post
  // belongs to more than one. Resolved to a slug list first so the post
  // query stays a single filtered read rather than a join the client has
  // to unpick.
  let slugsInCategory: string[] | null = null;
  if (category) {
    const { data: cat } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('slug', category)
      .maybeSingle();
    if (cat) {
      const { data: links } = await supabase
        .from('blog_post_categories')
        .select('post_slug')
        .eq('category_id', cat.id);
      slugsInCategory = (links ?? []).map((l) => l.post_slug);
    } else {
      // An unknown category in the URL returns nothing, rather than
      // silently ignoring the filter and showing everything as though it
      // had matched.
      slugsInCategory = [];
    }
  }

  let query = supabase
    .from('blog_posts')
    .select('slug, title, excerpt, header_image_url, published_at')
    .not('published_at', 'is', null);

  // Full text search over the generated tsvector (migration 197),
  // weighted so a title match outranks a body match. websearch syntax so a
  // reader can type a quoted phrase and have it behave.
  if (q && q.trim()) {
    query = query.textSearch('search_tsv', q.trim(), { type: 'websearch', config: 'english' });
  }
  if (slugsInCategory !== null) {
    query = query.in('slug', slugsInCategory);
  }

  const { data: posts } = await query.order('published_at', { ascending: false });

  const activeCategory = categories?.find((c) => c.slug === category) ?? null;
  const filtering = Boolean((q && q.trim()) || category);

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold text-denim mb-2">Blog</h1>
        {/* SS-586, Racquel's locked-in replacement verbatim. Three fixes:
            the stilted opener is gone, the em dash is gone, and the
            attribution moves from the app to the practice -- a reader on
            sortandplace.com/blog should be steered toward hiring
            Sort + Place; the app already has waitlist callouts inside the
            articles. Wordmark is "Sort + Place" with the plus -- correct
            for text; the ampersand form is the logo lockup only (SS-582).
            Width rule (Racquel, 3 Aug late): the header inherits the same
            container as the card grid -- no independent cap. Option A's
            max-w-3xl is superseded; it landed ~300px short of the grid
            edge, which is why this is inheritance, not another number. */}
        <p className="text-sm text-dusk mb-8">
          Notes from running real households. Kitchens, pantries, staff, Yom Tov, and the systems that hold when
          nobody is watching. From the Sort + Place team.
        </p>

        {/* SS-639: the sign-up panel is GONE from here (Racquel's ruling).
            It sat above every post card, so the first thing a reader met
            was a request for their email before they had been given
            anything. It now lives at the foot of each article, after the
            reader has actually had something -- see app/blog/[slug]. */}

        {/* 1.7: CATEGORY FILTERS ARE THE PRIMARY CONTROL HERE, with search
            beside them. The rail on an article carries the same two, but
            secondary: its category chips link back into this page rather
            than filtering in place, so there is one filtering mechanism,
            not two that can disagree. */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Link
            href="/blog"
            aria-current={!category ? 'page' : undefined}
            className={`inline-block rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              !category
                ? 'bg-denim text-white border-denim'
                : 'border-cardBorder text-denim hover:border-brass hover:text-brass'
            }`}
          >
            {es ? 'Todo' : 'All'}
          </Link>
          {(categories ?? []).map((c) => (
            <Link
              key={c.slug}
              href={`/blog?category=${c.slug}`}
              aria-current={category === c.slug ? 'page' : undefined}
              className={`inline-block rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                category === c.slug
                  ? 'bg-denim text-white border-denim'
                  : 'border-cardBorder text-denim hover:border-brass hover:text-brass'
              }`}
            >
              {es ? c.label_es : c.label_en}
            </Link>
          ))}

          {/* GET, so a result is a real shareable URL and it works with
              JavaScript off. The active category rides along in a hidden
              field, so searching does not silently drop the filter the
              reader can still see selected above. */}
          <form action="/blog" method="get" role="search" className="ml-auto">
            {category && <input type="hidden" name="category" value={category} />}
            <label htmlFor="blog-q" className="sr-only">
              {es ? 'Buscar en el blog' : 'Search the blog'}
            </label>
            <input
              id="blog-q"
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder={es ? 'Buscar' : 'Search'}
              className="bg-card border border-cardBorder rounded-full px-4 py-1.5 text-[13px] text-denim placeholder:text-denim/40 focus:outline-none focus:ring-1 focus:ring-denim/40"
            />
          </form>
        </div>

        {/* An empty result under a filter is a different fact from an empty
            blog, and must not read the same. */}
        {(!posts || posts.length === 0) && (
          <p className="text-sm text-dusk">
            {filtering
              ? es
                ? 'Ninguna publicación coincide con esa búsqueda.'
                : 'No posts match that search.'
              : es
                ? 'Todavía no hay publicaciones.'
                : 'No posts yet.'}
          </p>
        )}

        {filtering && posts && posts.length > 0 && (
          <p className="text-[13px] text-dusk mb-5">
            {posts.length}{' '}
            {posts.length === 1
              ? es ? 'publicación' : 'post'
              : es ? 'publicaciones' : 'posts'}
            {activeCategory ? ` · ${es ? activeCategory.label_es : activeCategory.label_en}` : ''}
            {q && q.trim() ? ` · ${q.trim()}` : ''}
            {'  '}
            <Link href="/blog" className="underline underline-offset-2 hover:text-denim">
              {es ? 'Borrar' : 'Clear'}
            </Link>
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(posts ?? []).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-xl2 bg-card border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow overflow-hidden"
            >
              {post.header_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.header_image_url}
                  alt=""
                  loading="lazy"
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-5">
                <p className="text-xs text-dusk mb-1">
                  {new Date(post.published_at!).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <h2 className="font-display text-xl font-semibold text-denim mb-2 leading-snug">{post.title}</h2>
                {post.excerpt && <p className="text-sm text-dusk leading-relaxed">{post.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
