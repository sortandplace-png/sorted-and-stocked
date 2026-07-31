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
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

async function fetchPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, body_markdown, header_image_url, cta_label, cta_url, published_at')
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
  if (!post) return { title: 'Blog — Sort + Place' };
  return {
    title: `${post.title} | Sort + Place`,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
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

  // body_markdown opens with "# <title>" -- the title renders separately
  // above, so the duplicate heading line is stripped (same treatment
  // BlogPostDetail.tsx applies on the internal view).
  const body = post.body_markdown.replace(/^#\s+[^\n]*\r?\n+/, '');

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
      <MarketingHeader />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10">
        <Link href="/blog" className="text-sm text-dusk hover:text-denim underline underline-offset-2 mb-6 inline-block">
          ← Blog
        </Link>

        <article className="bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
          {post.header_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.header_image_url} alt="" className="w-full max-h-72 object-cover" />
          )}
          <div className="p-6 sm:p-8">
            <p className="text-xs text-dusk mb-2">
              {new Date(post.published_at!).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <h1 className="font-display text-3xl font-semibold text-denim mb-6 leading-tight">{post.title}</h1>
            {renderSimpleMarkdown(body)}

            {post.cta_label && post.cta_url && (
              <div className="mt-8 pt-6 border-t border-cardBorder text-center">
                <a
                  href={post.cta_url}
                  className="inline-block bg-denim text-white text-sm font-semibold uppercase tracking-[0.12em] px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
                >
                  {post.cta_label}
                </a>
              </div>
            )}
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
