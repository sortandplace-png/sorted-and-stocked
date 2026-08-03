// components/blog/PinterestSaveButton.tsx -- 3 Aug batch extra.
// A Save button overlaid on the blog header image. Deliberately the
// no-script pin-create URL rather than Pinterest's pinit.js embed: no
// third-party script on the marketing surface, nothing to break when
// their loader changes, and the button works with JS disabled.
//
// The two rules from PINTEREST-COPY.md are encoded here, not left to the
// caller: the pin's link is the SPECIFIC post at the apex canonical
// (never the homepage, never the www or app host), and the description
// is sentence copy -- the post's excerpt, falling back to the title.
//
// Pinterest's brand red on the button is intentional and stays: the
// button reads as "Pinterest" at a glance the way a grey pill would not.
import { CANONICAL_ORIGIN } from '@/lib/site-url';

export default function PinterestSaveButton({
  slug,
  imageUrl,
  description,
  variant = 'solid',
}: {
  slug: string;
  imageUrl: string;
  description: string;
  /** 'solid' is always visible (header image). 'hover' fades in on
   *  desktop hover/focus but stays ALWAYS visible under 640px -- an
   *  opacity-0 element is still tappable, and an invisible tap target
   *  on the touch devices that have no hover would be worse than none. */
  variant?: 'solid' | 'hover';
}) {
  const href = `https://www.pinterest.com/pin/create/button/?${new URLSearchParams({
    url: `${CANONICAL_ORIGIN}/blog/${slug}`,
    media: imageUrl,
    description,
  }).toString()}`;
  const reveal =
    variant === 'hover'
      ? ' sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
      : '';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Save to Pinterest"
      className={`absolute top-3 left-3 inline-flex items-center gap-1.5 bg-[#E60023] text-white text-[13px] font-semibold pl-2.5 pr-3.5 py-1.5 rounded-full shadow-card hover:opacity-90 transition-opacity${reveal}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 4.1 2.47 7.61 6 9.15-.09-.78-.16-1.98.03-2.83.18-.77 1.15-4.88 1.15-4.88s-.29-.59-.29-1.46c0-1.37.79-2.39 1.78-2.39.84 0 1.25.63 1.25 1.39 0 .85-.54 2.11-.82 3.29-.23.98.49 1.78 1.46 1.78 1.75 0 3.1-1.85 3.1-4.52 0-2.36-1.7-4.01-4.12-4.01-2.81 0-4.46 2.11-4.46 4.29 0 .85.33 1.76.74 2.25.08.1.09.19.07.29-.08.31-.25 1-.28 1.14-.04.19-.15.23-.34.14-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.46 0 6.16 2.47 6.16 5.77 0 3.44-2.17 6.21-5.18 6.21-1.01 0-1.96-.53-2.29-1.15l-.62 2.37c-.22.87-.83 1.96-1.24 2.62.93.29 1.92.45 2.95.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
      </svg>
      Save
    </a>
  );
}
