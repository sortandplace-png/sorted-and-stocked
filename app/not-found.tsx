// app/not-found.tsx
// There was no custom 404, so Next served its default: a bare "404 | This
// page could not be found" with NO LINK ANYWHERE. A reader who clicked a
// printable that had not landed yet hit a dead end with no route back to
// the article, and their only way out was the back button or closing the
// tab.
//
// This is the general fix, not a printables fix. Any dead link on the
// marketing site now offers a way home.
//
// Deliberately marketing chrome: the overwhelming majority of 404s here
// are readers on a public page, not signed-in staff. It carries no
// household data and no auth-dependent state, so it renders identically to
// everyone.
import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export const metadata = {
  title: 'Page not found | Sort + Place',
  // A 404 must never be indexed as content.
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 py-16">
        <div className="max-w-[34rem] bg-card border border-cardBorder rounded-xl2 px-7 py-8">
          <h1 className="font-display text-2xl font-semibold text-denim mb-3">
            That page is not here
          </h1>
          <p className="text-[15px] text-dusk leading-relaxed">
            The link may be old, or the file may not have been published yet. Nothing is broken on
            your end.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href="/blog"
              className="inline-block bg-denim text-white text-sm font-medium px-5 py-2.5 rounded-xl2 hover:opacity-90 transition-opacity"
            >
              Back to the blog
            </Link>
            <Link
              href="/"
              className="inline-block border border-cardBorder text-denim text-sm font-medium px-5 py-2.5 rounded-xl2 hover:border-brass transition-colors"
            >
              Home
            </Link>
            <Link
              href="/contact"
              className="inline-block border border-cardBorder text-denim text-sm font-medium px-5 py-2.5 rounded-xl2 hover:border-brass transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
