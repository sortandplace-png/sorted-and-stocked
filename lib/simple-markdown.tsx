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
// renders as inert text. A future link sweep returning anything other than
// /welcome or /contact is therefore a defect by definition.
import type { ReactNode } from 'react';

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

function renderInline(text: string): ReactNode[] {
  // The image alternative must precede the link alternative: ![alt](src)
  // contains [alt](src), so without it the link pattern consumes that span
  // and strands the "!" in copy -- the old alt-leak bug in miniature.
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    const image = part.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      const [, alt, src] = image;
      if (!isAllowedImageSrc(src)) return null;
      return (
        // Plain <img>, not next/image, matching how the blog already renders
        // header images -- storage srcs would otherwise need remotePatterns
        // config, and a config miss renders a broken image at request time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-auto rounded-xl2 border border-cardBorder shadow-card my-5"
        />
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
      return (
        <em key={i} className="text-dusk">
          {part.slice(1, -1)}
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

export function renderSimpleMarkdown(markdown: string): ReactNode[] {
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
  return blocks.map((block, i) => {
    if (block.trim() === '---') {
      return <hr key={i} className="border-cardBorder my-6" />;
    }
    if (block.startsWith('### ')) {
      return (
        <h3 key={i} id={headingId(block.slice(4))} className="scroll-mt-24 font-display text-lg font-semibold text-denim mt-5 mb-2">
          {renderInline(block.slice(4))}
        </h3>
      );
    }
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} id={headingId(block.slice(3))} className="scroll-mt-24 font-display text-xl font-semibold text-denim mt-6 mb-2">
          {renderInline(block.slice(3))}
        </h2>
      );
    }
    if (block.startsWith('# ')) {
      return (
        <h1 key={i} id={headingId(block.slice(2))} className="scroll-mt-24 font-display text-2xl font-semibold text-denim mt-2 mb-3">
          {renderInline(block.slice(2))}
        </h1>
      );
    }
    const lines = block.split('\n');
    // `> ` blockquote: the package's CTA panels. Rendered as a Concept B
    // callout card, inner lines as stacked paragraphs.
    if (lines.every((l) => l.trimStart().startsWith('>'))) {
      const inner = lines.map((l) => l.trimStart().replace(/^>\s?/, ''));
      return (
        <div key={i} className="bg-mist border border-brass/30 rounded-xl2 px-5 py-4 my-5 space-y-1">
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
        <ul key={i} className="list-disc pl-5 mb-4 space-y-1">
          {lines.map((l, j) => (
            <li key={j} className="text-sm text-denim leading-relaxed">
              {renderInline(l.trimStart().slice(2))}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="text-sm text-denim leading-relaxed mb-4">
        {renderInline(block)}
      </p>
    );
  });
}
