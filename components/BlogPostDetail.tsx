'use client';

import Link from 'next/link';
import { Printer, Mail, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface BlogPostDetailProps {
  propertyId: string;
  title: string;
  publishDate: string;
  headerImageUrl?: string;
  headerImageAlt?: string;
  content: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export default function BlogPostDetail({
  propertyId,
  title,
  publishDate,
  headerImageUrl,
  headerImageAlt,
  content,
  ctaLabel,
  ctaUrl,
}: BlogPostDetailProps) {
  const publishDateObj = new Date(publishDate);
  const formattedDate = publishDateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const subject = `Check out: ${title}`;
    const body = `I thought you might enjoy reading "${title}" from Sorted & Stocked.\n\n${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleWhatsApp = () => {
    const message = `Check out this article: "${title}" - ${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h2 className="font-display text-3xl font-semibold text-denim mt-8 mb-3">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="font-display text-2xl font-semibold text-denim mt-8 mb-3">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="font-display text-xl font-semibold text-denim mt-6 mb-2">{children}</h4>
    ),
    p: ({ children }) => (
      <p className="font-interDisplay text-base text-denim leading-relaxed mb-4">{children}</p>
    ),
    strong: ({ children }) => <strong className="font-semibold text-denim">{children}</strong>,
    ul: ({ children }) => (
      <ul className="font-interDisplay list-disc pl-6 mb-4 space-y-1 text-denim">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="font-interDisplay list-decimal pl-6 mb-4 space-y-1 text-denim">{children}</ol>
    ),
    a: ({ children, href }) => (
      <a href={href} className="text-brass underline underline-offset-2 hover:text-brass/80">
        {children}
      </a>
    ),
  };

  // Resolve CTA URL: handle bare paths, placeholders, and special cases
  const resolvedCtaUrl = ctaUrl ? (() => {
    // Already has /properties prefix → use as-is (with [id] replacement if present)
    if (ctaUrl.startsWith('/properties/')) {
      return ctaUrl.replace('[id]', propertyId);
    }
    // /properties or other root paths → use as-is
    if (ctaUrl === '/properties') {
      return ctaUrl;
    }
    // Bare path (e.g., /shopping, /household-knowledge) → add property scope
    return `/properties/${propertyId}${ctaUrl}`;
  })() : null;

  // body_markdown leads with "# <title>" -- already shown above as the page
  // header, so drop that line here or it renders twice.
  const bodyWithoutTitle = content.replace(/^#\s+.*\n+/, '');

  return (
    <article className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-serif text-denim mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          {title}
        </h1>
        <p className="text-sm text-dusk">{formattedDate}</p>
      </div>

      {/* Header Image */}
      {headerImageUrl && (
        <div className="mb-8 rounded-lg overflow-hidden shadow-sm">
          <img
            src={headerImageUrl}
            alt={headerImageAlt || title}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* Share Actions */}
      <div className="flex gap-3 mb-8 pb-8 border-b border-brass/20">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mist hover:bg-brass/10 text-denim transition border border-brass/20"
          title="Print this article"
        >
          <Printer size={18} />
          <span className="text-sm">Print</span>
        </button>
        <button
          onClick={handleEmail}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mist hover:bg-brass/10 text-denim transition border border-brass/20"
          title="Email this article"
        >
          <Mail size={18} />
          <span className="text-sm">Email</span>
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mist hover:bg-brass/10 text-denim transition border border-brass/20"
          title="Share on WhatsApp"
        >
          <MessageCircle size={18} />
          <span className="text-sm">WhatsApp</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-none mb-8">
        <ReactMarkdown components={markdownComponents}>{bodyWithoutTitle}</ReactMarkdown>
      </div>

      {/* CTA Button */}
      {ctaLabel && resolvedCtaUrl && (
        <div className="mt-12 pt-8 border-t border-brass/20">
          <Link
            href={resolvedCtaUrl}
            className="inline-block px-6 py-3 bg-denim text-white rounded-lg hover:bg-denim/90 transition font-medium"
          >
            {ctaLabel}
          </Link>
        </div>
      )}

      {/* Back Link */}
      <div className="mt-12 pt-8">
        <Link
          href={`/properties/${propertyId}/blog`}
          className="text-dusk hover:text-denim underline underline-offset-2"
        >
          ← Back to Blog
        </Link>
      </div>
    </article>
  );
}
