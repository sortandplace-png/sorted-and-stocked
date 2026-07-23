'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  publish_date: string;
  header_image_url: string | null;
  header_image_alt: string | null;
}

interface BlogPostsListProps {
  propertyId: string;
  posts: BlogPost[];
}

export default function BlogPostsList({ propertyId, posts }: BlogPostsListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {posts.map((post) => {
        const publishDate = parseISO(post.publish_date);
        const formattedDate = format(publishDate, 'MMM d, yyyy');

        return (
          <Link
            key={post.id}
            href={`/properties/${propertyId}/blog/${post.slug}`}
            className="group rounded-lg overflow-hidden border border-charcoal/10 hover:border-charcoal/30 hover:shadow-md transition"
          >
            {/* Header Image */}
            {post.header_image_url ? (
              <div className="overflow-hidden h-40 bg-charcoal/5">
                <img
                  src={post.header_image_url}
                  alt={post.header_image_alt || post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-gold-light to-charcoal/10 flex items-center justify-center">
                <span className="text-4xl">📖</span>
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <p className="text-xs text-charcoal/50 mb-2">{formattedDate}</p>
              <h3 className="font-serif text-lg text-charcoal mb-2 group-hover:text-charcoal/70 transition" style={{ fontFamily: 'Playfair Display, serif' }}>
                {post.title}
              </h3>
              {post.description && (
                <p className="text-sm text-charcoal/70 line-clamp-2">
                  {post.description}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
