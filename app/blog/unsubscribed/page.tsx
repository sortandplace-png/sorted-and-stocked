// app/blog/unsubscribed/page.tsx
// SS-672. Where /api/subscribe/unsubscribe puts the reader after writing
// unsubscribed_at. Same shape and same reasoning as ./subscribed: static
// segment under the public /blog prefix, no work done here.
import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export const metadata = {
  title: 'Unsubscribed | Sort + Place',
  robots: { index: false, follow: false },
};

const COPY = {
  en: {
    ok: {
      heading: 'You are unsubscribed',
      body: 'Nothing further will be sent to this address. The printables you already downloaded are yours to keep.',
    },
    invalid: {
      heading: 'That link did not work',
      body: 'We could not read the address from that link, so nothing was changed. Use the unsubscribe link at the foot of any email we sent you.',
    },
    back: 'Back to the blog',
  },
  es: {
    ok: {
      heading: 'Cancelaste la suscripción',
      body: 'No se enviará nada más a esta dirección. Los imprimibles que ya descargaste son tuyos.',
    },
    invalid: {
      heading: 'Ese enlace no funcionó',
      body: 'No pudimos leer la dirección de ese enlace, así que no se cambió nada. Usa el enlace para cancelar la suscripción al pie de cualquier correo que te enviamos.',
    },
    back: 'Volver al blog',
  },
} as const;

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; lang?: string }>;
}) {
  const { state, lang } = await searchParams;
  const locale = lang === 'es' ? 'es' : 'en';
  const key = state === 'invalid' ? 'invalid' : 'ok';
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
              className="inline-block border border-cardBorder text-denim text-sm font-medium px-5 py-2.5 rounded-xl2 hover:border-brass transition-colors"
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
