'use client';

import Link from 'next/link';
import { Printer, Mail, MessageCircle } from 'lucide-react';

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

  return (
    <article className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-serif text-charcoal mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          {title}
        </h1>
        <p className="text-sm text-charcoal/60">{formattedDate}</p>
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
      <div className="flex gap-3 mb-8 pb-8 border-b border-charcoal/10">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal transition"
          title="Print this article"
        >
          <Printer size={18} />
          <span className="text-sm">Print</span>
        </button>
        <button
          onClick={handleEmail}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal transition"
          title="Email this article"
        >
          <Mail size={18} />
          <span className="text-sm">Email</span>
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal transition"
          title="Share on WhatsApp"
        >
          <MessageCircle size={18} />
          <span className="text-sm">WhatsApp</span>
        </button>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none mb-8 text-charcoal leading-relaxed">
        {/* Render markdown-like content or plain text for now */}
        {content.split('\n').map((paragraph, idx) => (
          paragraph.trim() && <p key={idx} className="mb-4">{paragraph}</p>
        ))}
      </div>

      {/* CTA Button */}
      {ctaLabel && resolvedCtaUrl && (
        <div className="mt-12 pt-8 border-t border-charcoal/10">
          <Link
            href={resolvedCtaUrl}
            className="inline-block px-6 py-3 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition font-medium"
          >
            {ctaLabel}
          </Link>
        </div>
      )}

      {/* Back Link */}
      <div className="mt-12 pt-8">
        <Link
          href={`/properties/${propertyId}/blog`}
          className="text-charcoal/60 hover:text-charcoal underline underline-offset-2"
        >
          ← Back to Blog
        </Link>
      </div>
    </article>
  );
}
