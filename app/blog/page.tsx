// app/blog/page.tsx
// Public, unauthenticated -- see PUBLIC_PATHS in lib/supabase/middleware.ts.
// Meant to be reachable and indexable without a login, unlike every other
// route in this app.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Blog — Sorted & Stocked',
};

// Public content that changes whenever a post is published -- must never
// serve a stale cached list.
export const dynamic = 'force-dynamic';

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

  return (
    <div className="min-h-screen bg-mist">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold text-denim mb-8">Blog</h1>

        {(!posts || posts.length === 0) && (
          <p className="text-sm text-dusk">No posts yet.</p>
        )}

        <div className="space-y-4">
          {(posts ?? []).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="relative block rounded-xl2 bg-card border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow p-5"
            >
              <p className="text-xs text-dusk mb-1">
                {new Date(post.published_at!).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <h2 className="font-display text-xl font-semibold text-denim mb-2">{post.title}</h2>
              {post.excerpt && <p className="text-sm text-dusk leading-relaxed">{post.excerpt}</p>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
