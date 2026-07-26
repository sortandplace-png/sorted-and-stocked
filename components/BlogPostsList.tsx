'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface BlogPost {
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string;
  header_image_url: string | null;
}

interface BlogPostsListProps {
  propertyId: string;
  posts: BlogPost[];
}

export default function BlogPostsList({ propertyId, posts }: BlogPostsListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {posts.map((post) => {
        const publishDate = parseISO(post.published_at);
        const formattedDate = format(publishDate, 'MMM d, yyyy');

        return (
          <Link
            key={post.slug}
            href={`/properties/${propertyId}/blog/${post.slug}`}
            className="group rounded-lg overflow-hidden border border-brass/20 hover:border-brass/40 hover:shadow-md transition bg-mist"
          >
            {/* Header Image */}
            {post.header_image_url ? (
              <div className="overflow-hidden h-40 bg-brass/10">
                <img
                  src={post.header_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-brass/20 to-brass/5 flex items-center justify-center">
                <span className="text-4xl">📖</span>
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <p className="text-xs text-dusk mb-2">{formattedDate}</p>
              <h3 className="font-serif text-lg text-denim mb-2 group-hover:text-denim/70 transition" style={{ fontFamily: 'Playfair Display, serif' }}>
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="text-sm text-dusk line-clamp-2">
                  {post.excerpt}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
