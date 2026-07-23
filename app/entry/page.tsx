// app/entry/page.tsx
// The real app's branded pre-auth landing screen -- didn't exist before
// tonight (only /welcome, which is a separate pre-launch marketing/
// waitlist page on a different palette entirely, unrelated to this).
// Deliberately not wired as a forced first stop: "/" still redirects
// straight into the authenticated app per the existing standing note in
// app/welcome/page.tsx, and /login, /signup, /forgot-password keep
// working exactly as before for anyone who lands there directly (a
// bookmark, a password-reset email link, etc.) -- this page is additive,
// reachable and fully built, not a new mandatory hop in front of routes
// that already work.
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthWordmark from '@/components/auth/AuthWordmark';
import AuthContactLink from '@/components/auth/AuthContactLink';
import LocaleToggle from '@/components/LocaleToggle';

export default async function EntryPage() {
  const t = await getTranslations('auth.welcome');

  return (
    <>
      <div className="fixed top-5 right-6 z-[200]">
        <LocaleToggle variant="light" />
      </div>
      <AuthLayout wide>
        <div className="min-h-screen flex flex-col items-center justify-center py-10 px-6 w-full">
          <div className="flex flex-col items-center w-full max-w-[380px]">
            <AuthWordmark size="large" />

            <div
              className="w-12 h-px my-7"
              style={{ background: 'linear-gradient(90deg, transparent, #C6A46E, transparent)' }}
            />

            <p className="font-display italic font-light text-[28px] text-denim tracking-[0.03em] text-center leading-[1.3] mb-10">
              {t('message')}
            </p>

            <div className="flex flex-col gap-3.5 w-full">
              <Link
                href="/login"
                className="w-full text-center bg-denimBlue hover:bg-[#5A7CAE] text-white font-interDisplay text-sm font-bold tracking-[0.06em] px-8 py-[15px] rounded-full transition-colors"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/signup"
                className="w-full text-center bg-transparent text-denim hover:text-denimBlue border-[1.5px] border-[rgba(46,74,98,0.2)] hover:border-denimBlue font-interDisplay text-sm font-semibold tracking-[0.04em] px-8 py-3.5 rounded-full transition-colors"
              >
                {t('createAccount')}
              </Link>
            </div>

            <p className="mt-12 font-interDisplay text-xs text-dusk tracking-[0.04em] text-center">
              {t('poweredBy')}
            </p>
            <div className="mt-3">
              <AuthContactLink />
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
