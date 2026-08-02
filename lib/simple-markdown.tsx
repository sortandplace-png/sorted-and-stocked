// lib/simple-markdown.tsx
// Deliberately not a full markdown library -- blog_posts.body_markdown uses
// exactly the constructs the SEO content package's articles use (confirmed
// against the actual files, 2 Aug): #/##/### headers, **bold** and *italic*
// spans, `* ` / `- ` bullet lists, `> ` blockquote CTA panels, `---` rules,
// [text](/internal-path) links, and blank-line-separated paragraphs.
// Returns real JSX elements, never an HTML string, so there's no
// dangerouslySetInnerHTML/XSS surface even though this content is
// manager-authored and trusted.
//
// Links render as anchors ONLY for site-internal paths (leading "/"): the
// blog must never grow off-site links by accident through a pasted draft --
// anything else renders as its plain text.
import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
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

export function renderSimpleMarkdown(markdown: string): ReactNode[] {
  const blocks = markdown.trim().split(/\n\s*\n/);
  return blocks.map((block, i) => {
    if (block.trim() === '---') {
      return <hr key={i} className="border-cardBorder my-6" />;
    }
    if (block.startsWith('### ')) {
      return (
        <h3 key={i} className="font-display text-lg font-semibold text-denim mt-5 mb-2">
          {renderInline(block.slice(4))}
        </h3>
      );
    }
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="font-display text-xl font-semibold text-denim mt-6 mb-2">
          {renderInline(block.slice(3))}
        </h2>
      );
    }
    if (block.startsWith('# ')) {
      return (
        <h1 key={i} className="font-display text-2xl font-semibold text-denim mt-2 mb-3">
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
