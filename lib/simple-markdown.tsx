// lib/simple-markdown.tsx
// Deliberately not a full markdown library -- blog_posts.body_markdown only
// ever uses #/## headers, **bold** spans, and blank-line-separated
// paragraphs (confirmed against the actual drafted posts). Returns real JSX
// elements, never an HTML string, so there's no dangerouslySetInnerHTML/XSS
// surface to worry about even though this content is currently
// manager-authored and trusted.
import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-denim">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function renderSimpleMarkdown(markdown: string): ReactNode[] {
  const blocks = markdown.trim().split(/\n\s*\n/);
  return blocks.map((block, i) => {
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
    return (
      <p key={i} className="text-sm text-denim leading-relaxed mb-4">
        {renderInline(block)}
      </p>
    );
  });
}
