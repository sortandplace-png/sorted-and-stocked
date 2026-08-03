// components/blog/RelatedReadingCards.tsx -- SS-584.
// Related Reading as Concept B cards: thumbnail, title, one-line gloss.
// Three across on desktop, stacked on mobile. The title and gloss come
// from the authored markdown bullets (curated anchor text), the thumbnail
// from the target post's header_image_url.
import Link from 'next/link';

export type RelatedCard = {
  slug: string;
  title: string;
  gloss: string | null;
  imageUrl: string | null;
};

export default function RelatedReadingCards({ posts }: { posts: RelatedCard[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-denim mt-6 mb-3">Related Reading</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group block bg-card border border-cardBorder rounded-xl2 overflow-hidden shadow-card hover:border-brass/60 transition-colors"
          >
            {p.imageUrl && (
              // Plain <img>, matching how the blog renders header images --
              // storage srcs would otherwise need remotePatterns config.
              // Alt is empty by design: the card's visible title is the
              // accessible label, and the thumbnail repeats it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" loading="lazy" className="w-full aspect-[16/10] object-cover" />
            )}
            <div className="p-3">
              <p className="text-sm font-semibold text-denim leading-snug group-hover:underline underline-offset-2">
                {p.title}
              </p>
              {p.gloss && <p className="text-[12px] text-dusk leading-snug mt-1">{p.gloss}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
