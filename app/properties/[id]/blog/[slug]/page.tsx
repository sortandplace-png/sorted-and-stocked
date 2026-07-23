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
  // Minimal metadata generation; consider fetching post for full title if needed.
  return {
    title: `Blog - Sorted & Stocked`,
    description: 'Household management insights.',
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
    .eq('property_id', propertyId)
    .eq('slug', slug)
    .single();

  if (error || !post) {
    notFound();
  }

  return (
    <BlogPostDetail
      propertyId={propertyId}
      title={post.title}
      publishDate={post.publish_date}
      headerImageUrl={post.header_image_url}
      headerImageAlt={post.header_image_alt}
      content={post.content || ''}
      ctaLabel={post.cta_label}
      ctaUrl={post.cta_url}
    />
  );
}
