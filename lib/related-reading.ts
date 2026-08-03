// lib/related-reading.ts -- SS-584.
// Every live post carries a "## Related Reading" section of exactly this
// shape (verified against all 11 live bodies, 3 Aug):
//
//     ## Related Reading
//
//     - [Post Title](/blog/slug): one-line gloss
//
// The blog page lifts that section out of the markdown and renders it as
// visual cards (thumbnail from the target post's header_image_url) instead
// of text bullets. The section is NOT always the last thing in the body:
// the long four posts (11/16/21/22) follow it with a bold consultation CTA
// line and an italic boilerplate line -- which is why extraction returns
// BEFORE and AFTER segments rather than assuming end-of-body, so the cards
// render exactly where the bullets sat and everything after them keeps its
// place. (First draft anchored the regex to $ and silently missed those
// four; the SQL shape-check caught it.)
//
// FAIL OPEN: if the section is missing or its bullets don't parse, the
// whole body comes back as `before` and the renderer shows the links as
// ordinary bullets, exactly today's behaviour. A parse miss must degrade
// to text, never to a missing section.

export type RelatedItem = {
  slug: string;
  title: string;
  gloss: string | null;
};

const SECTION_RE =
  /\n## Related Reading\s*\n((?:[ \t]*[-*][ \t]+\[[^\]]+\]\([^)\s]+\)[^\n]*\n?)+)/;

const ITEM_RE = /[-*][ \t]+\[([^\]]+)\]\((\/blog\/[^)\s]+)\)(?::[ \t]*([^\n]+))?/g;

export function extractRelatedReading(markdown: string): {
  before: string;
  after: string;
  items: RelatedItem[];
} {
  const m = markdown.match(SECTION_RE);
  if (!m || m.index === undefined) return { before: markdown, after: '', items: [] };
  const items: RelatedItem[] = [];
  for (const im of m[1].matchAll(ITEM_RE)) {
    items.push({
      title: im[1].trim(),
      slug: im[2].slice('/blog/'.length),
      gloss: im[3]?.trim() || null,
    });
  }
  // A section whose bullets are all non-/blog/ links (nothing to build a
  // card from) stays in the body as text.
  if (items.length === 0) return { before: markdown, after: '', items: [] };
  return {
    before: markdown.slice(0, m.index).trimEnd(),
    after: markdown.slice(m.index + m[0].length).trim(),
    items,
  };
}
