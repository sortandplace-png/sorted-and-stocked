// components/marketing/FaqList.tsx
// SS-434 (Racquel, three screenshots): Concept B BENTO TILES, not
// full-width accordion rows -- two columns on desktop, one on phone,
// each tile with the same picture slot the /services cards carry
// (bannerSrc per item, Concept B gradient placeholder until Racquel
// supplies real photos -- never stock imagery). The plus-sign
// affordance is gone per the same ruling.
//
// Still native <details>/<summary> on purpose: the disclosure comes free
// from the browser, this stays a server component with zero client JS,
// and every answer is real DOM text for the crawler -- which matters
// more here than anywhere, since this page's entire content IS the
// crawlable text.
import Pin from '@/components/PinAccent';

export type FaqItem = { q: string; a: string; bannerSrc?: string | null };

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {items.map(({ q, a, bannerSrc }) => (
        // The tile is a DIV wrapping the disclosure, not the <details>
        // itself: a closed <details> hides every child except its
        // <summary>, which silently swallowed the picture slot and the
        // pin (caught on the priority-zero screenshot pass, 2 Aug).
        <div
          key={q}
          className="relative bg-card border border-cardBorder rounded-xl2 shadow-card overflow-hidden"
        >
          <Pin size="sm" />
          {/* Picture slot, shared config shape with the /services banner
              slots: real photo when configured, Concept B gradient
              placeholder meanwhile. */}
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerSrc} alt="" className="w-full h-[110px] object-cover" />
          ) : (
            <div
              className="w-full h-[110px]"
              style={{
                backgroundImage: 'linear-gradient(135deg, #E8EEF6 0%, #FFFAF3 62%, rgba(198,164,110,0.28) 100%)',
              }}
              aria-hidden="true"
            />
          )}
          <details className="group">
            <summary className="cursor-pointer list-none px-5 py-4 font-display font-bold text-lg text-denim">
              {q}
            </summary>
            <p className="px-5 pb-4 text-sm text-dusk leading-relaxed">{a}</p>
          </details>
        </div>
      ))}
    </div>
  );
}
