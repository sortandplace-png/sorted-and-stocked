// app/properties/[id]/blog/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server';
import BlogPostDetail from '@/components/BlogPostDetail';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .single();

  return {
    title: post ? `${post.title} - Sorted & Stocked Blog` : 'Blog - Sorted & Stocked',
    description: post?.excerpt ?? 'Household management insights.',
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id: propertyId, slug } = await params;
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching blog post:', error);
  }
  if (error || !post) {
    notFound();
  }

  return (
    <BlogPostDetail
      propertyId={propertyId}
      title={post.title}
      publishDate={post.published_at}
      headerImageUrl={post.header_image_url}
      content={post.body_markdown}
      ctaLabel={post.cta_label}
      ctaUrl={post.cta_url}
    />
  );
}
