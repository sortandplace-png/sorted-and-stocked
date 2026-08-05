// lib/simple-markdown.tsx
// Deliberately not a full markdown library -- blog_posts.body_markdown uses
// exactly the constructs the SEO content package's articles use (confirmed
// against the actual files, 2 Aug): #/##/### headers, **bold** and *italic*
// spans, `* ` / `- ` bullet lists, `> ` blockquote CTA panels, `---` rules,
// [text](/internal-path) links, ![alt](src) images (added 3 Aug -- before
// that, image syntax half-matched the link pattern and the ALT TEXT leaked
// into the rendered copy as literal prose, which is why the preflight
// treated any inline image as a defect), and blank-line-separated
// paragraphs.
// Returns real JSX elements, never an HTML string, so there's no
// dangerouslySetInnerHTML/XSS surface even though this content is
// manager-authored and trusted.
//
// Links render as anchors ONLY for site-internal paths (leading "/").
// NO OUTBOUND LINKS (Racquel ruling, 2 Aug late). A citation-host allowlist
// briefly lived here so verified primary sources could render as real
// anchors; it is gone. The deciding incident: a III URL verified working in
// the afternoon rendered as a 404 by evening. Every outbound link is a
// permanent liability someone has to keep re-checking, and attribution --
// "NFPA finds...", "the Insurance Information Institute recommends..." --
// is what carries E-E-A-T, not the hyperlink. Named sources stay in prose;
// the anchor does not.
//
// This is also the enforcement point: because nothing but a leading-"/"
// path can become an <a>, any external URL that reaches body_markdown
// renders as inert text. A future link sweep returning anything other
// than /welcome, /contact, or a /blog/<slug> cross-link (Related Reading
// links between posts are standard as of 3 Aug -- all 11 live posts carry
// them) is therefore a defect by definition.
import type { ReactNode } from 'react';
import { ClipboardList, Clock, Users, Home, Package, CalendarDays, Sparkles, ListChecks } from 'lucide-react';
import Pin from '@/components/PinAccent';
import PinterestSaveButton from '@/components/blog/PinterestSaveButton';
import { CANONICAL_ORIGIN } from '@/lib/site-url';

// Images follow the SAME source policy as links, for the same reason: an
// external src is a permanent liability someone has to keep re-checking,
// and a hotlinked host can swap the pixels after review. Allowed sources
// are site-relative paths and THIS project's public storage -- everything
// else renders as NOTHING (not the alt text: alt-as-copy is the exact
// defect this feature replaces, and a visible placeholder would ship
// reviewer-facing noise as reader-facing copy).
const STORAGE_PUBLIC_PREFIX = 'https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public/';

function isAllowedImageSrc(src: string): boolean {
  return src.startsWith('/') || src.startsWith(STORAGE_PUBLIC_PREFIX);
}

// SS-636 2c. Shared by the takeaway-tile branch and by the FAQ grouping
// loop, which must be able to recognise one WITHOUT rendering it -- see
// the break in that loop for why a single definition matters here.
function isTakeawayBlock(block: string): boolean {
  const lines = block.split('\n');
  return lines.length > 1 && /^>\s*Eyebrow:/i.test(lines[0].trimStart());
}

function renderInline(text: string): ReactNode[] {
  // The image alternative must precede the link alternative: ![alt](src)
  // contains [alt](src), so without it the link pattern consumes that span
  // and strands the "!" in copy -- the old alt-leak bug in miniature.
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    const image = part.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      const [, alt, rawSrc] = image;
      if (!isAllowedImageSrc(rawSrc)) return null;
      // Optional #WxH fragment carries intrinsic dimensions -- e.g.
      // ![alt](/blog-images/x.webp#1536x1024). A fragment is legal URL
      // syntax the server never sees, so authors can state the size without
      // any non-standard markdown, and the width/height attributes reserve
      // the box so the article does not reflow as images lazy-load below
      // the fold. Stripped from the emitted src; absent fragment = no
      // dimension attributes, exactly the old behaviour.
      const dim = rawSrc.match(/#(\d{2,5})x(\d{2,5})$/);
      const src = dim ? rawSrc.slice(0, -dim[0].length) : rawSrc;
      const size = dim ? { width: Number(dim[1]), height: Number(dim[2]) } : {};
      // NO frame classes (SS-584, Racquel's measured ruling, 3 Aug): the
      // inline graphics are already designed as pinned cards on a linen
      // ground -- their own rounded corners, background and pin dot --
      // so the border/rounded/shadow wrapper this replaces double-framed
      // them, "a card inside a card". The image sits directly on the
      // article background and supplies its own framing. Margins live on
      // the standalone-block wrapper in renderSimpleMarkdown, which knows
      // whether a heading precedes the image; this element carries none.
      // SS-610 (Racquel: "yse graphic is to big"): CAP THE IMAGE, NOT THE
      // CONTAINER. The blog-22 iceberg is 1344x1792 portrait and at full
      // figure width stood taller than a viewport, stranding its caption
      // below the fold. max-h-[70vh] clamps height; w-auto lets the width
      // scale with it so nothing distorts; max-w-full keeps wide images
      // exactly as before (every current landscape source is wider than
      // the container, so they still fill it); mx-auto centres a portrait
      // in the leftover width. Deliberately ratio-independent rather than
      // keyed to the #WxH hint: only 4 of the 5 inline images carry that
      // hint, so a hint-driven rule would miss un-hinted portraits. The
      // CONTAINER WIDTH IS UNTOUCHED -- narrowing it would reopen the
      // exact drift the width ruling closed.
      const cls = 'max-h-[70vh] w-auto max-w-full mx-auto block';
      // Plain <img>, not next/image, matching how the blog already renders
      // header images -- storage srcs would otherwise need remotePatterns
      // config, and a config miss renders a broken image at request time.
      /* eslint-disable @next/next/no-img-element */
      const img = <img key={i} src={src} alt={alt} loading="lazy" {...size} className={cls} />;
      /* eslint-enable @next/next/no-img-element */
      if (!src.endsWith('.webp')) return img;
      // .webp ships with a same-path .png sibling (the asset pipeline
      // delivers both; preflight-blog.py warns when the sibling is missing
      // for site-relative srcs). <picture> serves the webp to everything
      // modern and the png to anything that cannot decode webp.
      return (
        <picture key={i}>
          <source srcSet={src} type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src.replace(/\.webp$/, '.png')} alt={alt} loading="lazy" {...size} className={cls} />
        </picture>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-denim">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith('/')) {
        return (
          <a key={i} href={href} className="text-denim underline underline-offset-2 hover:text-brass">
            {label}
          </a>
        );
      }
      // Anything not site-internal renders as its plain label, never a link.
      return <span key={i}>{label}</span>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      // Recurse like the **bold** branch above. This branch used to emit
      // part.slice(1, -1) as plain text, which published raw [text](url)
      // syntax inside every italic caption -- 86 instances across 31
      // posts when counted (3 Aug). The captions were always written
      // correctly; the renderer was the defect, so the fix is here and
      // not 86 hand-edits.
      return (
        <em key={i} className="text-dusk">
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function isBullet(l: string) {
  const t = l.trimStart();
  return t.startsWith('* ') || t.startsWith('- ');
}

// WIDTH RULE, superseded 4 Aug by SS-636 2b -- read both halves before
// changing this line.
//
// The 3 Aug ruling ("i wnt the text to fit the page") removed every
// independent width cap: prose inherited the article card so text and
// images ended at the same edge, and line length rose to ~110
// characters. SS-610 is the same ruling and IT STILL STANDS: text
// widens to match content and never shrinks to fit an image.
//
// 2b is not that decision. Racquel, 4 Aug: "Do not read SS-610 as
// blocking a magazine column." SS-610 was about not SQUEEZING content.
// Choosing a reading measure and putting a real margin beside it is a
// different choice, and the margin is what makes every other device
// possible -- a pull quote in a single column can only say "set apart"
// by getting bigger, which is how Stage C ended up with quotes outranking
// their own headings.
//
// SS-611 RESTORED, 5 Aug. 2b's half of the rule above is REVERSED. Read
// this half last; it is the one in force.
//
// 2b's bargain was: give up reading width, buy a margin, and the margin
// pays for the pull quotes. The margin was never paid for. 2a removed
// every pull quote from blog-21 hours before 2b shipped, and checking all
// 11 published posts before making this change found ZERO '>>' markers and
// ZERO 'Eyebrow:' markers in any of them. So the margin is empty on every
// live post and cannot fill itself. The site gave up 15rem of reading
// column to hold nothing.
//
// What a reader actually saw: prose stopping at 34rem while the figures
// beside it ran to the full card, so the text was narrower than the
// pictures. That is the inverse of Racquel's ruling of 3 Aug, "y would i
// narrow the images > i wnt the text to fit the page", and she has now
// ruled the same way twice.
//
// The fix is structural rather than a second number: prose takes the SAME
// class the figures already take, so the two share one left edge and one
// right edge and cannot drift apart again. A new cap here, even a wider
// one, would just be the next value to disagree with the images.
//
// ACCEPTED DELIBERATELY: the measure is now the card width and line length
// rises past the 71 characters SS-584 tuned for. Racquel has ruled on that
// twice. If it reads long the lever is font size or line height, NEVER
// width.
//
// This also settles the foot of the article, which is where she said
// "awful": Related Reading, the boilerplate, the rules, the consultation
// button and the sign-up were sitting at four different widths inside
// about 500px. One measure aligns all of them, and the rules now match
// the content they separate rather than the card.
const MEASURE = 'w-full';
const BLEED = 'w-full';
// The gutter is gone, so margin items are in-column blocks now. Kept as a
// named constant rather than deleted: the '>>' branch still references it,
// and item 2 (quotes back in column, set apart by indent, rule and colour,
// NEVER by size) is a separate pass that has not run yet. This value is
// deliberately layout-neutral so nothing reserves space beside the prose
// in the meantime.
const MARGIN_COL = '';

// A block that is ONLY an image gets no prose wrapper at all, so the
// figure spans the full card width. Inside a text paragraph an image still
// flows at prose width, which is what a wrapped inline figure should do.
// Alt and src are captured so the pin overlay can describe the figure and
// point Pinterest at its pixels.
const IMAGE_ONLY_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;

// GitHub-style heading slugs. The "On This Page" tables of contents already
// written into four LIVE posts (blog-11, 16, 21, 22) use anchors of exactly
// this shape -- #building-your-system-schedules -- and until now this
// renderer emitted no id on any heading at all, so every one of those jump
// links did nothing. Verified against blog-16's real headings before
// writing this: all 9 of its anchors reproduce exactly.
//
// Inline markers are stripped BEFORE slugging, because the heading text is
// markdown, not plain text: "1. Schedules, *when things happen*" must slug
// as 1-schedules-when-things-happen, not carry the asterisks through.
function slugifyHeading(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// The FAQ section renders as Concept B TILES matching /faq exactly
// (SS-584 reopened, Racquel's screenshot ruling, 3 Aug): the first pass
// here shipped full-width mist pills stacked seven deep -- the same
// defect SS-434 recorded on the marketing FAQ, rebuilt to a superseded
// design while the corrected FaqList was already live on /faq. THE
// MARKETING FAQ TILES ARE THE CANONICAL TREATMENT FOR ANY QUESTION-LIST
// SURFACE; check /faq before building the next one. Two across on
// desktop, stacked on mobile; white card, brass ICON STROKE (never a
// fill), 10px gold-radial pin top right OUTSIDE the <details> (a closed
// details hides every child but its summary and would swallow the pin --
// the exact bug FaqList documents); default grid stretch + h-full for
// equal heights within a row (SS-529). Still native <details>: answers
// expand in place, no client JS, real DOM text for the crawler.
// Presentation only -- faq_jsonld is a separate column this file never
// touches, so rich-results parity is unaffected.
const FAQ_HEADING = 'Frequently Asked Questions';

// Blog questions are arbitrary text, so tiles draw brass stroke icons
// from a fixed household-flavored pool by position -- deterministic
// (server render stays stable) and varied within any post's set of 4-7.
const FAQ_ICONS = [ClipboardList, Clock, Users, Home, Package, CalendarDays, Sparkles, ListChecks];

// opts.pin: when the caller is a public post page, standalone figures get
// a hover Save-to-Pinterest overlay pinning THIS post's apex URL with the
// figure's own pixels and alt text -- readers pin the graphics to their
// boards with the post link attached (the domain is claimed, so saves
// attribute to Sort + Place). No pin context (internal views, previews)
// means no overlay, same markup as before.
export function renderSimpleMarkdown(
  markdown: string,
  opts?: { pin?: { slug: string } }
): ReactNode[] {
  const blocks = markdown.trim().split(/\n\s*\n/);
  // Duplicate slugs are real here, not hypothetical: blog-16 has an H2
  // "What Is a Household Management System?" and an FAQ H3 "What is a
  // household management system?", which slug identically. GitHub's rule --
  // first occurrence keeps the bare slug, later ones get -1, -2 -- is what
  // the TOC needs anyway, since the TOC always points at the first. Without
  // the counter the page would ship duplicate ids, which is invalid HTML.
  const seen = new Map<string, number>();
  function headingId(raw: string): string {
    const base = slugifyHeading(raw);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  }
  // SS-636 A (typography rhythm). The articles read flat because every
  // block carried the same weight. isLead marks the FIRST paragraph of an
  // article so it can open at a larger size, the way an editorial standfirst
  // does. Tracked by the caller rather than by index, because the first
  // block is often a heading or a figure, not the opening paragraph.
  let leadUsed = false;
  // SS-636 2c pull quotes are AUTHORED (`>> `), not derived. A derived
  // version was built first and measured against all 11 live articles:
  // lift the opening sentence of every third section into the display
  // face. It is superseded, and Racquel's own note is the reason -- "five
  // pull quotes in an 8,500 character article is the ceiling, not a
  // target... pull the wrong one and it reads worse than plain prose."
  // Which sentence carries the argument is a judgement about meaning, and
  // position in the document is not a proxy for it. The measured run
  // showed that directly: of six sentences the rule chose, two were
  // multi-sentence runs and none was the line she picked as the article's
  // whole argument ("one person is the database"), which sits mid
  // paragraph where no positional rule would ever reach it.
  function renderBlock(block: string, i: number | string, afterHeading = false): ReactNode {
    if (block.trim() === '---') {
      return <hr key={i} className={`border-cardBorder my-6 ${MEASURE}`} />;
    }
    if (block.startsWith('### ')) {
      return (
        // Subheadings get weight and air but NO brass rule -- the rule
        // marks major sections, and one on every h3 would make the page
        // read as stripes rather than as sections.
        <h3 key={i} id={headingId(block.slice(4))} className={`scroll-mt-24 font-display text-xl font-semibold text-denim mt-6 mb-1.5 ${MEASURE}`}>
          {renderInline(block.slice(4))}
        </h3>
      );
    }
    if (block.startsWith('## ')) {
      return (
        // SS-636 2a: h2 32px against h3 20px. The acceptance test is
        // Racquel's: cover the brass rule, and you must still be able to
        // tell the section heading from an item inside it BY SIZE ALONE.
        // 24 vs 20 failed that; 32 vs 20 passes it.
        //
        // And the rhythm must GROUP: the gap above a section (mt-16 plus
        // pt-7 = 64+28px) is now much larger than the gap above an item
        // inside it (mt-6 = 24px). An even ladder reads as a list of
        // equals; this reads as sections containing items.
        // SS-636 A: real weight, and a brass hairline ABOVE each section
        // heading. The rule is the section break -- it does the work the
        // old barely-heavier heading could not, without touching the
        // measure (SS-610: text widens to match content, never shrinks).
        <h2 key={i} id={headingId(block.slice(3))} className={`scroll-mt-24 font-display text-[32px] leading-tight font-bold text-denim border-t border-brass/50 pt-7 mt-16 mb-4 ${MEASURE}`}>
          {renderInline(block.slice(3))}
        </h2>
      );
    }
    if (block.startsWith('# ')) {
      return (
        <h1 key={i} id={headingId(block.slice(2))} className={`scroll-mt-24 font-display text-2xl font-semibold text-denim mt-2 mb-3 ${MEASURE}`}>
          {renderInline(block.slice(2))}
        </h1>
      );
    }
    const lines = block.split('\n');
    // SS-636 2b, PULL QUOTE -> THE MARGIN. `>> ` -- checked before the
    // single-`>` panel below, because ">>" also starts with ">" and the
    // panel would eat it.
    //
    // Stage C put this in the reading column at 26px and Racquel's
    // verdict was that it read as a heading: on the live page the quote
    // under "Search that works on a phone" was set larger than its own
    // heading, so the hierarchy inverted. That is not a size that can be
    // tuned down. In ONE column there is no "beside", so the only way a
    // quote can say "set apart" is by getting bigger, and bigger is the
    // one thing that also means "ranks higher".
    //
    // The margin fixes it structurally: being OUT of the column is what
    // marks it, so the type gets SMALLER (15px against 14px body, in the
    // display face) instead of larger, and it no longer competes with
    // headings because it is not in the same column as them.
    //
    // Below lg there is no margin. It falls back into the flow as a
    // short indented line with a brass rule down its left edge -- still
    // quieter than body copy, never wider.
    if (lines.every((l) => l.trimStart().startsWith('>>'))) {
      const inner = lines.map((l) => l.trimStart().replace(/^>>\s?/, '')).filter((l) => l.trim() !== '');
      return (
        <aside
          key={i}
          className={`${MARGIN_COL} border-l-2 border-brass/60 pl-4 py-1 my-6 lg:my-2 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-3 max-w-[34rem]`}
        >
          {inner.map((l, j) => (
            <p key={j} className="font-display text-[15px] leading-[1.5] text-dusk">
              {renderInline(l)}
            </p>
          ))}
        </aside>
      );
    }
    // SS-636 2b, TAKEAWAY -> NO TILE. A `>` block whose first line is
    // "Eyebrow: ..." -- the shape Racquel's copy already arrives in.
    //
    // Stage C made this a mist tile and her verdict was that it read as a
    // system alert: a wide pale box with a small label means NOTICE in an
    // app, and in an article it stops the reading. The tile shape belongs
    // to the app. What is left is what a magazine actually does to close
    // a section -- a short brass rule and a line of italic.
    if (isTakeawayBlock(block)) {
      const inner = lines.map((l) => l.trimStart().replace(/^>\s?/, ''));
      const eyebrow = inner[0].replace(/^Eyebrow:\s*/i, '');
      const body = inner.slice(1).filter((l) => l.trim() !== '');
      return (
        <div key={i} className={`my-7 ${MEASURE}`}>
          <div className="w-16 border-t border-brass/60 mb-3" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-brass font-medium mb-1">{eyebrow}</p>
          {body.map((l, j) => (
            <p key={j} className="text-sm italic text-dusk leading-relaxed">
              {renderInline(l)}
            </p>
          ))}
        </div>
      );
    }
    // `> ` blockquote: the package's CTA panels. Rendered as a Concept B
    // callout card, inner lines as stacked paragraphs.
    if (lines.every((l) => l.trimStart().startsWith('>'))) {
      const inner = lines.map((l) => l.trimStart().replace(/^>\s?/, ''));
      return (
        <div key={i} className={`bg-mist border border-brass/30 rounded-xl2 px-5 py-4 my-5 space-y-1 ${MEASURE}`}>
          {inner
            .filter((l) => l.trim() !== '')
            .map((l, j) => (
              <p key={j} className="text-sm text-denim leading-relaxed">
                {renderInline(l)}
              </p>
            ))}
        </div>
      );
    }
    if (lines.length > 0 && lines.every(isBullet)) {
      return (
        // SS-636 B: every list becomes the SAME mist tile the app already
        // uses, so the blog stops looking like a different product.
        // It is also the reading-comfort fix: text inside a tile is
        // narrower BY CONSTRUCTION (the padding), which gives a
        // comfortable measure as a side effect of a structural change --
        // WITHOUT narrowing any container. SS-610 stands untouched.
        <ul key={i} className={`relative bg-mist border border-cardBorder rounded-xl2 shadow-card list-disc pl-9 pr-6 py-5 my-5 space-y-1.5 ${MEASURE}`}>
          <Pin size="sm" />
          {lines.map((l, j) => (
            <li key={j} className="text-sm text-denim leading-relaxed">
              {renderInline(l.trimStart().slice(2))}
            </li>
          ))}
        </ul>
      );
    }
    if (IMAGE_ONLY_RE.test(block.trim())) {
      // Fallback margins for image-only blocks reached OUTSIDE the main
      // loop (FAQ answers); the loop's own branch handles heading
      // adjacency for article-body figures.
      return <div key={i} className="mt-4 mb-4">{renderInline(block.trim())}</div>;
    }
    // SS-636 A: the opening paragraph sets the article's voice, so it
    // opens larger and looser than body copy. Every later paragraph keeps
    // the body size -- a whole article at lead size is not a lead.
    const isLead = !leadUsed;
    leadUsed = true;
    return (
      <p
        key={i}
        className={
          isLead
            ? `text-[17px] text-denim leading-[1.7] mb-6 ${MEASURE}`
            : `text-sm text-denim leading-relaxed mb-4 ${MEASURE}`
        }
      >
        {renderInline(block)}
      </p>
    );
  }

  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const imageOnly = block.trim().match(IMAGE_ONLY_RE);
    if (imageOnly) {
      // Heading-adjacent figures sit TIGHT under their heading (SS-584,
      // measured ruling): an image directly under an h2/h3 illustrates
      // that section, so the gap above it (heading mb-2 wins the margin
      // collapse: 8px) is noticeably tighter than the 16px below it.
      // A figure between paragraphs keeps the paragraph rhythm on both
      // sides.
      const afterHeading = i > 0 && /^#{1,3} /.test(blocks[i - 1]);
      const [, alt, rawSrc] = imageOnly;
      const src = rawSrc.replace(/#\d{2,5}x\d{2,5}$/, '');
      const pinnable = opts?.pin && isAllowedImageSrc(rawSrc);
      out.push(
        <div key={i} className={`${afterHeading ? 'mt-1' : 'mt-4'} mb-4 lg:clear-right ${BLEED}${pinnable ? ' relative group' : ''}`}>
          {renderInline(block.trim())}
          {pinnable && (
            <PinterestSaveButton
              slug={opts.pin!.slug}
              imageUrl={src.startsWith('/') ? `${CANONICAL_ORIGIN}${src}` : src}
              description={alt}
              variant="hover"
            />
          )}
        </div>
      );
      continue;
    }
    // Case-insensitive: the 3 Aug staging package (blog-39/40) writes
    // "Frequently asked questions" in sentence case while the live 11 use
    // title case -- both must get the tile treatment, or the next staged
    // post silently ships the wall the tiles replaced.
    if (block.startsWith('## ') && block.slice(3).trim().toLowerCase() === FAQ_HEADING.toLowerCase()) {
      // Group the ### question blocks (and each question's following
      // answer blocks) until the next H1/H2 or end of body. headingId is
      // still called for every heading IN DOCUMENT ORDER, so the id
      // sequence -- including the blog-16 duplicate-slug -1 suffix -- is
      // byte-identical to the flat rendering this replaces.
      out.push(renderBlock(block, i));
      const faqItems: { q: string; id: string; answers: string[] }[] = [];
      let j = i + 1;
      // A takeaway tile ENDS the FAQ, it is never an answer. Without this
      // the collector below swallows it -- anything that is not a "### "
      // question gets appended to the previous question's answers -- and
      // the tile renders as plain prose inside the last FAQ item. Caught
      // in production on blog-21, where Racquel's closing "Start here"
      // tile sits after the FAQ and before the consultation CTA: its copy
      // was on the page, its tile was not, so a text-only check would
      // have passed it.
      while (
        j < blocks.length &&
        !blocks[j].startsWith('## ') &&
        !blocks[j].startsWith('# ') &&
        !isTakeawayBlock(blocks[j])
      ) {
        if (blocks[j].startsWith('### ')) {
          const q = blocks[j].slice(4);
          faqItems.push({ q, id: headingId(q), answers: [] });
        } else if (faqItems.length > 0) {
          faqItems[faqItems.length - 1].answers.push(blocks[j]);
        } else {
          // Prose between the heading and the first question is not FAQ
          // shape -- leave everything to the normal flat path (fail open).
          break;
        }
        j++;
      }
      if (faqItems.length > 0) {
        out.push(
          // Full card width like the Related Reading grid -- two tiles do
          // not fit the 34rem prose measure. No items-start (SS-529):
          // default stretch + h-full gives every tile its row's height,
          // so a two-line question cannot unbalance its neighbour.
          <div key={`faq-${i}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {faqItems.map((item, k) => {
              const Icon = FAQ_ICONS[k % FAQ_ICONS.length];
              return (
                // Tight shadow, NOT shadow-card (SS-584 follow-up, Racquel's
                // screenshot): there is no group wrapper with a shadow --
                // verified by enumerating every shadowed element -- but
                // shadow-card is 0 16px 40px, and seven of those blurs
                // overlapping in a dense grid merge into one large soft
                // rectangle "behind" the grid, bleeding past the odd last
                // tile. Tiles keep a shadow; it just ends at their edges.
                <div key={k} className="relative h-full bg-card border border-cardBorder rounded-xl2 shadow-[0_2px_8px_rgba(90,120,150,.08)]">
                  <Pin size="sm" />
                  <details className="group">
                    {/* pr-8 clears the pin, exactly as FaqList documents.
                        The h3 keeps its anchor id inside the summary, so
                        the heading outline and any future #fragment links
                        are unchanged by the tiles. */}
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden pl-5 pr-8 py-4 flex items-start gap-3">
                      <Icon
                        className="w-[18px] h-[18px] text-brass shrink-0 mt-[5px]"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <h3 id={item.id} className="scroll-mt-24 font-display font-bold text-lg text-denim leading-snug">
                        {renderInline(item.q)}
                      </h3>
                    </summary>
                    {/* Answers match /faq's text-dusk treatment; bullets
                        keep list form. Rendered here rather than through
                        renderBlock so the tile interior matches the
                        canonical build, not the article prose. */}
                    <div className="px-5 pb-4 space-y-2">
                      {item.answers.map((a, m) => {
                        const ls = a.split('\n');
                        if (ls.length > 0 && ls.every(isBullet)) {
                          return (
                            <ul key={m} className="list-disc pl-5 space-y-1 text-sm text-dusk leading-relaxed">
                              {ls.map((l, n) => (
                                <li key={n}>{renderInline(l.trimStart().slice(2))}</li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <p key={m} className="text-sm text-dusk leading-relaxed">
                            {renderInline(a)}
                          </p>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        );
        i = j - 1;
        continue;
      }
      continue;
    }
    out.push(renderBlock(block, i, i > 0 && /^#{1,3} /.test(blocks[i - 1])));
  }
  return out;
}
