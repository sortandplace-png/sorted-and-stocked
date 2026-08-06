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
import ArticleRail from '@/components/blog/ArticleRail';
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
    bio: 'Sort + Place is a professional organizing and household management practice serving families in Lakewood, New Jersey and the surrounding tristate area.',
  },
  es: {
    ctaHeading: '¿Quieres esto en tu propia casa?',
    ctaLine:
      'Creamos los sistemas, etiquetamos los estantes y capacitamos a quienes los mantienen.',
    ctaFallbackLabel: 'Reserva tu consulta',
    followHeading: 'Sigue el blog',
    followLine: 'Publicaciones nuevas por correo, cuando las publicamos. Nada más.',
    // Written here for the first time. There was never a Spanish bio,
    // which is the whole argument for moving it: one markdown field cannot
    // hold two languages, so as long as the line lived in body_markdown a
    // Spanish reader was always going to get the English one.
    bio: 'Sort + Place es una práctica profesional de organización y gestión del hogar que atiende a familias en Lakewood, Nueva Jersey y el área tristate.',
  },
} as const;

export const dynamic = 'force-dynamic';

async function fetchPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, body_markdown, header_image_url, header_image_caption_en, header_image_caption_es, header_image_alt_en, header_image_alt_es, cta_label, cta_url, published_at, updated_at, faq_jsonld')
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
      {/* SS-665 answered: the container widens to carry the rail beside the
          article. The article's own measure is unchanged. */}
      <main className="flex-1 w-full max-w-[75rem] mx-auto px-4 py-10">
        <Link href="/blog" className="text-sm text-dusk hover:text-denim underline underline-offset-2 mb-6 inline-block">
          ← Blog
        </Link>

        {/* THE RAIL SITS BENEATH THE ARTICLE BELOW 900px, NEVER ABOVE IT.
            Done with flex-col ordering rather than a second copy of the
            markup, because two copies drift. Above would put the email ask
            before the reader has seen a word, which is the exact thing
            SS-639 removed from the index. */}
        <div className="flex flex-col min-[900px]:flex-row gap-8 items-start">
          <article className="w-full min-w-0 bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
          {post.header_image_url && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.header_image_url}
                /* ALT DESCRIBES WHAT IS SHOWN, and is not the caption. All
                   11 published posts shipped alt="" until now, which is a
                   real accessibility defect rather than a nicety. Falls
                   back to the title only when no alt has been written, so
                   the image is never wholly unlabelled. */
                alt={(locale === 'es' ? post.header_image_alt_es : post.header_image_alt_en) || post.title}
                className="w-full max-h-72 object-cover"
              />
              <PinterestSaveButton
                slug={post.slug}
                imageUrl={post.header_image_url}
                description={post.excerpt ?? post.title}
              />
            </div>
          )}
          {/* CAPTION is author voice and says what the picture does not, so
              it is a separate column from alt and renders for everyone.
              Hidden entirely when empty: all 43 rows ship empty, and an
              empty italic bar under every header image would be worse than
              no caption at all. */}
          {(locale === 'es' ? post.header_image_caption_es : post.header_image_caption_en) && (
            <p className="px-6 sm:px-8 pt-3 text-[12px] italic text-dusk text-center">
              {locale === 'es' ? post.header_image_caption_es : post.header_image_caption_en}
            </p>
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

            {/* SS-709 second half. THE BIO NOW LIVES HERE, not in
                body_markdown.
                It was never author copy: the identical rule-plus-italic
                line was pasted into 31 rows, and migration 195 strips it
                from all 31 in the same commit that adds this. Both halves
                ship together on purpose. The strip without this render
                would silently delete the line from 31 posts, 4 of them
                published; this render without the strip would print it
                twice.
                The real reason to move it: a single markdown field cannot
                be bilingual, so a Spanish reader was always going to get
                the English sentence. It now follows getLocale like the
                card below it.
                Rule and italic reproduce what renderSimpleMarkdown emitted
                for "---" and "*...*", so the page looks unchanged. */}
            <hr className="border-cardBorder my-6 w-full" />
            <p className="text-sm italic text-dusk leading-relaxed w-full">{foot.bio}</p>

            {/* THE FOOT KEEPS THE CONSULTATION ONLY (1.5). Subscribe has
                moved to the rail, which closes SS-615 and SS-639 together:
                the consultation was being offered twice on one page, and
                the email ask sat where a reader met it before finishing
                the article. One ask here, the quieter one alongside.

                The two-column card went with it. With subscribe gone the
                right column had nothing in it, and a 40 percent empty
                panel is the same defect as the 15rem empty gutter SS-665
                raised. A margin only earns its space if something lives in
                it, and here nothing did. */}
            <div className="mt-10 rounded-xl2 border border-cardBorder overflow-hidden bg-card p-6 sm:p-7">
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
          </div>
          </article>

          <ArticleRail locale={locale === 'es' ? 'es' : 'en'} currentSlug={post.slug} />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
