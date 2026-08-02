// components/marketing/FaqList.tsx
// SS-434 (Racquel, three screenshots): Concept B BENTO TILES, not
// full-width accordion rows -- two columns on desktop, one on phone. The
// plus-sign affordance is gone per the same ruling.
//
// NO IMAGES ON THIS PAGE (Racquel ruling, 2 Aug late, after the defect's
// third report). The tiles used to carry the same picture slot the
// /services cards have, falling back to a Concept B gradient until real
// photos landed -- but no photo was ever configured for any FAQ item, so
// all eight rendered a permanent empty block roughly 65% of a collapsed
// tile's height. Ruled: a card here is a question, an image adds nothing,
// so the slot is deleted rather than filled. The `bannerSrc` prop is gone
// with it -- no caller ever set it, and removing it stops the slot being
// quietly reintroduced. Card treatment is otherwise untouched: white card,
// brass pin, rounded-xl2, shadow-card.
//
// Still native <details>/<summary> on purpose: the disclosure comes free
// from the browser, this stays a server component with zero client JS,
// and every answer is real DOM text for the crawler -- which matters
// more here than anywhere, since this page's entire content IS the
// crawlable text.
import Pin from '@/components/PinAccent';

export type FaqItem = { q: string; a: string };

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {items.map(({ q, a }) => (
        // The tile is a DIV wrapping the disclosure, not the <details>
        // itself: a closed <details> hides every child except its
        // <summary>, which silently swallowed the pin (caught on the
        // priority-zero screenshot pass, 2 Aug). That still applies with
        // the picture slot gone -- the pin must stay outside the details.
        <div
          key={q}
          className="relative bg-card border border-cardBorder rounded-xl2 shadow-card"
        >
          <Pin size="sm" />
          <details className="group">
            {/* pr-8, not px-5: with the picture slot removed the pin
                (top 11, right 12, 10px wide) now sits level with the
                question's first line instead of over the image, so the
                text needs clearance past it or a long question runs
                under the dot. */}
            <summary className="cursor-pointer list-none pl-5 pr-8 py-4 font-display font-bold text-lg text-denim">
              {q}
            </summary>
            <p className="px-5 pb-4 text-sm text-dusk leading-relaxed">{a}</p>
          </details>
        </div>
      ))}
    </div>
  );
}
