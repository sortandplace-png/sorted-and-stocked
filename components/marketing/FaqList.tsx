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
//
// ICONS (SS-528): one per question, BRASS STROKE ONLY. This is the
// sanctioned brass use -- icon strokes, eyebrow labels, the pin dot --
// and deliberately NOT a brass background circle, which would repeat the
// fill violation SS-527 just removed from the CTA. Stroke weight 1.75,
// 18px, under the 20px ceiling. They are the replacement visual weight
// for the image blocks removed in SS-504, not a reinstatement of images.
import type { LucideIcon } from 'lucide-react';
import Pin from '@/components/PinAccent';

export type FaqItem = { q: string; a: string; icon: LucideIcon };

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    // SS-529: NO items-start here. It explicitly opts the row out of the
    // grid's default `stretch`, so each tile sized to its own content --
    // and because three left-column questions wrap to two lines while only
    // one on the right does, the two columns stopped lining up. Default
    // stretch plus h-full on the tile gives every tile its row's height.
    // Content stays top-aligned by normal block flow, which is the point:
    // vertically centring it would leave short questions floating in the
    // middle of tall cards.
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map(({ q, a, icon: Icon }) => (
        // The tile is a DIV wrapping the disclosure, not the <details>
        // itself: a closed <details> hides every child except its
        // <summary>, which silently swallowed the pin (caught on the
        // priority-zero screenshot pass, 2 Aug). That still applies with
        // the picture slot gone -- the pin must stay outside the details.
        <div
          key={q}
          className="relative h-full bg-card border border-cardBorder rounded-xl2 shadow-card"
        >
          <Pin size="sm" />
          <details className="group">
            {/* pr-8, not px-5: with the picture slot removed the pin
                (top 11, right 12, 10px wide) now sits level with the
                question's first line instead of over the image, so the
                text needs clearance past it or a long question runs
                under the dot. */}
            <summary className="cursor-pointer list-none pl-5 pr-8 py-4 font-display font-bold text-lg text-denim flex items-start gap-3">
              <Icon
                className="w-[18px] h-[18px] text-brass shrink-0 mt-[5px]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{q}</span>
            </summary>
            <p className="px-5 pb-4 text-sm text-dusk leading-relaxed">{a}</p>
          </details>
        </div>
      ))}
    </div>
  );
}
