// app/blog/[slug]/page.tsx
// Public, unauthenticated -- see PUBLIC_PATHS in lib/supabase/middleware.ts.
// The SEO surface for a single post: real per-post metadata (title,
// description, OpenGraph image, canonical), Schema.org BlogPosting JSON-LD,
// the stored header image, and the post's own CTA -- all of which the
// internal /properties/[id]/blog/[slug] view already had while this public
// twin rendered a bare markdown block.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';
import { extractRelatedReading } from '@/lib/related-reading';
import RelatedReadingCards, { type RelatedCard } from '@/components/blog/RelatedReadingCards';
import PinterestSaveButton from '@/components/blog/PinterestSaveButton';
import SubscribeForm from '@/components/blog/SubscribeForm';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { getLocale } from 'next-intl/server';
import { SITE_URL, CANONICAL_ORIGIN } from '@/lib/site-url';

// SS-706, the article foot. Written EN and ES together rather than English
// now and Spanish later. NO DASHES: this is a marketing surface and the
// SS-666 check treats app/blog as absolute scope, so a dash here fails the
// build rather than reaching a reader.
const FOOT_COPY = {
  en: {
    ctaHeading: 'Want this running in your own house?',
    ctaLine:
      'We build the systems, label the shelves and train the people who keep it all going.',
    ctaFallbackLabel: 'Book Your Consultation',
    followHeading: 'Follow along',
    followLine: 'New posts by email, when we publish them. No more than that.',
  },
  es: {
    ctaHeading: '¿Quieres esto en tu propia casa?',
    ctaLine:
      'Creamos los sistemas, etiquetamos los estantes y capacitamos a quienes los mantienen.',
    ctaFallbackLabel: 'Reserva tu consulta',
    followHeading: 'Sigue el blog',
    followLine: 'Publicaciones nuevas por correo, cuando las publicamos. Nada más.',
  },
} as const;

export const dynamic = 'force-dynamic';

async function fetchPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, body_markdown, header_image_url, cta_label, cta_url, published_at, faq_jsonld')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  // SS-586: no em dashes in page chrome.
  if (!post) return { title: 'Blog | Sort + Place' };
  return {
    title: `${post.title} | Sort + Place`,
    description: post.excerpt ?? undefined,
    // SS-578: canonical pinned to the apex constant, not the env-overridable SITE_URL.
    alternates: { canonical: `${CANONICAL_ORIGIN}/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.published_at ?? undefined,
      images: post.header_image_url ? [{ url: post.header_image_url }] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  // SS-706. Read on the SERVER so the article foot renders in the reader's
  // language in the initial HTML, rather than flashing English and
  // swapping. SubscribeForm reads the same cookie on the client for its own
  // two messages, so both halves of the card agree.
  const locale = await getLocale();
  const foot = FOOT_COPY[locale === 'es' ? 'es' : 'en'];

  // body_markdown opens with "# <title>" -- the title renders separately
  // above, so the duplicate heading line is stripped (same treatment
  // BlogPostDetail.tsx applies on the internal view).
  const stripped = post.body_markdown.replace(/^#\s+[^\n]*\r?\n+/, '');

  // SS-584: the "## Related Reading" bullets render as cards instead of
  // text links -- thumbnail from each target post's header_image_url. The
  // cards go exactly where the bullets sat (the long four posts follow the
  // section with a CTA line and boilerplate, so it is not always last). If
  // the section doesn't parse, `before` is the whole body and the bullets
  // render as before; a target with no row or no image gets a text-only
  // card rather than being dropped, so the authored links always survive.
  const { before, after, items } = extractRelatedReading(stripped);
  let related: RelatedCard[] = [];
  if (items.length > 0) {
    const supabase = await createClient();
    const { data: targets } = await supabase
      .from('blog_posts')
      .select('slug, header_image_url')
      .in('slug', items.map((i) => i.slug))
      .not('published_at', 'is', null);
    const imageBySlug = new Map((targets ?? []).map((t) => [t.slug, t.header_image_url]));
    related = items.map((i) => ({ ...i, imageUrl: imageBySlug.get(i.slug) ?? null }));
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.header_image_url ?? undefined,
    datePublished: post.published_at,
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
    author: { '@type': 'Organization', name: 'Sort + Place', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Sort + Place', url: SITE_URL },
  };

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Migration 176: SEO-package articles ship a Schema.org FAQPage
          block; stored as jsonb per post, rendered only when present. */}
      {post.faq_jsonld && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(post.faq_jsonld) }} />
      )}
      <MarketingHeader />
      {/* SS-636 2b: sized TO the magazine layout, not rounded to a Tailwind
          step. 34rem reading column + 2rem gutter + 15rem margin = 51rem of
          inner width; add the card's p-8 (4rem) and the main's px-4 (2rem)
          and the container is 57rem. max-w-5xl was tried first and left
          142px of slack between the column and the margin, which read as
          the margin being detached from the text rather than beside it.
          The READING MEASURE is what is capped here; the container is
          WIDER than the max-w-4xl it replaced, not narrower. */}
      <main className="flex-1 w-full max-w-[57rem] mx-auto px-4 py-10">
        <Link href="/blog" className="text-sm text-dusk hover:text-denim underline underline-offset-2 mb-6 inline-block">
          ← Blog
        </Link>

        <article className="bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
          {post.header_image_url && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.header_image_url} alt="" className="w-full max-h-72 object-cover" />
              <PinterestSaveButton
                slug={post.slug}
                imageUrl={post.header_image_url}
                description={post.excerpt ?? post.title}
              />
            </div>
          )}
          <div className="p-6 sm:p-8">
            {/* Title and date stay FULL CARD WIDTH, not on the reading
                measure. They are the masthead of the page, not part of the
                reading column, and a 32px h1 wrapping early inside 34rem
                would read as a cramped column heading rather than a title. */}
            <div className="w-full">
              <p className="text-xs text-dusk mb-2">
                {new Date(post.published_at!).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <h1 className="font-display text-3xl font-semibold text-denim mb-6 leading-tight">{post.title}</h1>
            </div>
            {renderSimpleMarkdown(before, { pin: { slug: post.slug } })}

            <RelatedReadingCards posts={related} />

            {/* The tail after the Related Reading section (consultation CTA
                + boilerplate on the long four). Rendered separately, which
                resets the heading-id dedupe map -- safe because the tail
                carries no headings in any live post, only a bold line, a
                rule, and an italic line. */}
            {after && renderSimpleMarkdown(after)}

            {/* SS-706. ONE CARD, TWO COLUMNS, replacing what used to be a
                divider, a centred button and a separate email field
                stacked down the page. Four elements at four alignments
                inside about 500px was the "awful" tail; this is one object
                with one edge pair.

                The ORDER SS-639 ruled is intact: article, Related Reading,
                then the ask. The consultation is still the primary ask and
                still visually louder, it just no longer competes with the
                sign-up for vertical space. The sign-up is secondary by
                POSITION and TINT now rather than by being small and last.

                Stacks below 680px, where the column divider becomes a top
                border, because two 40% columns on a phone are two columns
                of nothing.

                THE FORM IS THE EXISTING COMPONENT, not a new one. It posts
                to /api/subscribe and carries the honeypot, the timing
                check, the IP rate limit, the dedupe, the locale and the
                signed token flow. A raw form posting to /subscribe would
                lose every one of those and hit a route that does not
                exist. bare drops its own top rule, which the column
                divider already provides.

                sourceDetail carries the slug so a sign-up is attributed to
                the article that earned it. */}
            <div className="mt-10 rounded-xl2 border border-cardBorder overflow-hidden flex flex-col min-[680px]:flex-row">
              <div className="min-[680px]:basis-3/5 bg-card p-6 sm:p-7">
                <h2 className="font-display text-[22px] leading-tight text-denim">
                  {foot.ctaHeading}
                </h2>
                <p className="text-[14px] text-dusk leading-relaxed mt-2 mb-5">{foot.ctaLine}</p>
                <a
                  href={post.cta_url || '/contact'}
                  className="inline-block bg-denim text-white text-sm font-semibold uppercase tracking-[0.12em] px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
                >
                  {post.cta_label || foot.ctaFallbackLabel}
                </a>
              </div>

              <div className="min-[680px]:basis-2/5 bg-linen border-t border-cardBorder min-[680px]:border-t-0 min-[680px]:border-l p-6 sm:p-7">
                <p className="font-display text-[17px] text-denim mb-2">{foot.followHeading}</p>
                <SubscribeForm
                  variant="inline"
                  bare
                  source="blog-article"
                  sourceDetail={post.slug}
                  line={foot.followLine}
                />
              </div>
            </div>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
