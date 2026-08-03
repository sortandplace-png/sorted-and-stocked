// app/sitemap/page.tsx
// SS-432 part 2: the human sitemap page at the marketing root. The
// machine one (app/sitemap.ts -> /sitemap.xml) has existed since SS-284
// and is what robots.txt and Search Console read; this page is the
// person-readable index of the same public surface. The two are siblings
// on purpose: this page lists what the XML lists, nothing app-side.
// The in-app sitemap (/properties/[id]/sitemap) is a different surface
// with a different job and stays where it is.
import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { CANONICAL_ORIGIN } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  alternates: { canonical: `${CANONICAL_ORIGIN}/sitemap` },
  title: 'Sitemap | Sort + Place',
  description: 'Every public page on sortandplace.com in one place: services, about, FAQ, contact, and all published articles.',
};

// Same freshness contract as the blog index: a new published post should
// appear here without a deploy.
export const dynamic = 'force-dynamic';

const PAGES = [
  { href: '/', label: 'Home', note: 'What Sort + Place does, and the household app behind it.' },
  { href: '/services', label: 'Services', note: 'Organization, meal planning, vendor scheduling, staff systems.' },
  { href: '/about', label: 'About', note: 'Who we are and how we work.' },
  { href: '/faq', label: 'FAQ', note: 'Common questions, answered plainly.' },
  { href: '/contact', label: 'Contact', note: 'Book a consultation or ask a question.' },
  { href: '/blog', label: 'Blog', note: 'Notes from running real households.' },
  { href: '/privacy.html', label: 'Privacy Policy', note: 'How we handle your information.' },
  { href: '/terms.html', label: 'Terms', note: 'The terms of using the site and app.' },
];

export default async function HumanSitemapPage() {
  // Degrades to the static pages if the database is unreachable -- a
  // sitemap must never be the page that errors (same rule as sitemap.ts).
  let posts: { slug: string; title: string }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, title, published_at')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false });
    posts = data ?? [];
  } catch {
    posts = [];
  }

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold text-denim mb-2">Sitemap</h1>
        <p className="text-sm text-dusk mb-8 max-w-3xl">
          Every public page on sortandplace.com, in one place.
        </p>

        <section className="mb-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-3">Pages</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-denim font-medium underline underline-offset-2 hover:text-denim/80">
                  {p.label}
                </Link>
                <span className="block text-sm text-dusk">{p.note}</span>
              </li>
            ))}
          </ul>
        </section>

        {posts.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-3">Articles</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 max-w-3xl">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="text-sm text-denim underline underline-offset-2 hover:text-denim/80"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
