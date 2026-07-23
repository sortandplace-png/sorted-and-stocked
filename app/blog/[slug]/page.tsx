// app/blog/[slug]/page.tsx
// Public, unauthenticated -- see PUBLIC_PATHS in lib/supabase/middleware.ts.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('slug, title, body_markdown, published_at')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();

  if (!post) notFound();

  return (
    <div className="min-h-screen bg-mist">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/blog" className="text-sm text-brass hover:underline mb-6 inline-block">
          ← Blog
        </Link>
        <p className="text-xs text-dusk mb-1">
          {new Date(post.published_at!).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <article className="bg-card rounded-xl3 border border-cardBorder shadow-card p-6 sm:p-8">
          {renderSimpleMarkdown(post.body_markdown)}
        </article>
      </div>
    </div>
  );
}
