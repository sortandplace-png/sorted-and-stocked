// app/properties/[id]/blog/page.tsx
import { createClient } from '@/lib/supabase/server';
import BlogPostsList from '@/components/BlogPostsList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: 'Blog - Sorted & Stocked',
    description: 'Household management insights and recipes.',
  };
}

export default async function BlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;
  const supabase = await createClient();

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, description, publish_date, header_image_url, header_image_alt')
    .eq('property_id', propertyId)
    .order('publish_date', { ascending: false });

  if (error) {
    console.error('Error fetching blog posts:', error);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href={`/properties/${propertyId}/dashboard`}
        className="inline-flex items-center gap-2 text-dusk hover:text-denim underline underline-offset-2 mb-6"
      >
        ← Back to Dashboard
      </Link>
      <div className="mb-12">
        <h1 className="text-4xl font-serif text-denim mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Sorted & Stocked Blog
        </h1>
        <p className="text-lg text-dusk">
          Tips, recipes, and household management insights
        </p>
      </div>

      {posts && posts.length > 0 ? (
        <BlogPostsList propertyId={propertyId} posts={posts} />
      ) : (
        <div className="text-center py-12">
          <p className="text-charcoal/60">No blog posts yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
