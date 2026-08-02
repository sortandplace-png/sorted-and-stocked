// app/sitemap.ts
// The sitemap public/robots.txt has been pointing at since SS-284.
//
// /services, /about, /faq and /contact were added below the day they went
// live (2026-07-29) -- they did not exist when this file was first written,
// which is why an earlier version of this comment explained their absence.
//
// Blog posts are included because they are the only public content that
// grows -- that is what a sitemap is actually for. Same query shape as
// app/blog/page.tsx: published_at NOT NULL is what "published" means here.
import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE = 'https://sortandplace.com';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    // Live since the Google-consent work (rewrites to static .html); listed
    // for the Search Console submission (2 Aug). App routes stay out.
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // A sitemap must never be the reason a deploy fails, so a database problem
  // degrades to the static routes rather than throwing.
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false });

    const posts: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.published_at ? new Date(p.published_at) : new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    }));

    return [...staticRoutes, ...posts];
  } catch {
    return staticRoutes;
  }
}
