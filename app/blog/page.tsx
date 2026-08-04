// app/blog/page.tsx
// Public, unauthenticated -- see PUBLIC_PATHS in lib/supabase/middleware.ts.
// This is the SEO surface: seven published articles on kosher household
// management are the content that gets sortandplace.com surfacing in
// Lakewood searches, so the page gets the full marketing treatment --
// shared header/footer, real metadata, header images -- rather than the
// bare list it launched as. sitemap.xml already emits /blog and every
// published slug (app/sitemap.ts).
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import SubscribeForm from '@/components/blog/SubscribeForm';
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

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, header_image_url, published_at')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

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

        {/* SS-630: opt-in, never a gate -- the blog stays open. */}
        <div className="mb-8 max-w-xl">
          <SubscribeForm source="blog" sourceDetail="blog-index" />
        </div>

        {(!posts || posts.length === 0) && <p className="text-sm text-dusk">No posts yet.</p>}

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
