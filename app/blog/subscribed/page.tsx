// app/blog/subscribed/page.tsx
// SS-672. Where /api/subscribe/confirm puts the reader after it has set
// confirmed_at. A static segment under /blog, so it takes precedence over
// [slug] and it is already public via PUBLIC_PATHS' startsWith('/blog').
//
// Deliberately NOT a page that does any work. The confirm route has
// already written the row and queued the welcome email by the time this
// renders; if the write lived here instead, a mail scanner prefetching the
// link would confirm the address without a person ever seeing it.
import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

// Transactional, reachable only with a signed token, and worthless in
// search results. Keeping it out of the index also keeps it out of the
// sitemap diffing that SS-432 set up.
export const metadata = {
  title: 'Subscription confirmed | Sort + Place',
  robots: { index: false, follow: false },
};

const COPY = {
  en: {
    ok: {
      heading: 'You are confirmed',
      body: 'Check your inbox. Your printables are on their way, and new posts will arrive when we publish them.',
    },
    unsubscribed: {
      heading: 'This address has opted out',
      body: 'You unsubscribed at some point, so an older confirmation link cannot put you back on the list. Sign up again from any post and you will get a fresh confirmation email.',
    },
    invalid: {
      heading: 'That link did not work',
      body: 'It may have already been used, or it may have expired. Sign up again from any post and a new confirmation email will arrive.',
    },
    back: 'Back to the blog',
  },
  es: {
    ok: {
      heading: 'Tu correo está confirmado',
      body: 'Revisa tu bandeja de entrada. Tus imprimibles van en camino, y las publicaciones nuevas llegarán cuando las publiquemos.',
    },
    unsubscribed: {
      heading: 'Esta dirección canceló la suscripción',
      body: 'Cancelaste la suscripción en algún momento, así que un enlace de confirmación antiguo no puede volver a inscribirte. Regístrate de nuevo desde cualquier publicación y recibirás un correo de confirmación nuevo.',
    },
    invalid: {
      heading: 'Ese enlace no funcionó',
      body: 'Puede que ya se haya usado o que haya caducado. Regístrate de nuevo desde cualquier publicación y llegará un correo de confirmación nuevo.',
    },
    back: 'Volver al blog',
  },
} as const;

export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; lang?: string }>;
}) {
  const { state, lang } = await searchParams;
  const locale = lang === 'es' ? 'es' : 'en';
  const key = state === 'unsubscribed' ? 'unsubscribed' : state === 'invalid' ? 'invalid' : 'ok';
  const copy = COPY[locale];

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 py-16">
        <div className="max-w-[34rem] bg-card border border-cardBorder rounded-xl2 px-7 py-8">
          <h1 className="font-display text-2xl font-semibold text-denim mb-3">
            {copy[key].heading}
          </h1>
          <p className="text-[15px] text-dusk leading-relaxed">{copy[key].body}</p>
          <p className="mt-7">
            <Link
              href="/blog"
              className="inline-block bg-denim text-white text-sm font-medium px-5 py-2.5 rounded-xl2 hover:opacity-90 transition-opacity"
            >
              {copy.back}
            </Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
