// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getEmailLinkOrigin } from '@/lib/site-url';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthWordmark from '@/components/auth/AuthWordmark';
import AuthInput from '@/components/auth/AuthInput';
import AuthErrorBox from '@/components/auth/AuthErrorBox';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthContactLink from '@/components/auth/AuthContactLink';
import LocaleToggle from '@/components/LocaleToggle';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Routes through the existing /auth/callback code-exchange handler,
    // which then forwards to /reset-password once the recovery session
    // is established. getEmailLinkOrigin, not a bare window.location.origin
    // or the fixed SITE_URL alone -- this now matches the real hostname
    // (app.sortandplace.com or www.sortandplace.com) when the request
    // genuinely came from one of those, but still falls back to SITE_URL
    // for anything else (localhost, a Vercel preview URL) so triggering
    // this from a local dev server still can't send a real person a real
    // email with a localhost link they couldn't open, same guarantee as
    // before -- see lib/site-url.ts.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getEmailLinkOrigin(window.location.origin)}/auth/callback?redirectTo=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <div className="fixed top-5 right-6 z-[200]">
        <LocaleToggle variant="light" />
      </div>
      <AuthLayout>
        <div className="mb-7">
          <AuthWordmark size="small" backHref="/entry" />
        </div>

        <AuthCard>
          {sent ? (
            <div className="flex flex-col items-center text-center py-2">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center mb-5"
                style={{ background: 'rgba(107,141,190,.12)', border: '1.5px solid rgba(107,141,190,.4)' }}
              >
                <svg width="22" height="17" viewBox="0 0 22 17" fill="none" aria-hidden="true">
                  <path d="M1.5 8.5L8 15 20.5 2" stroke="#6B8DBE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h1 className="font-display font-normal text-[30px] text-denim tracking-[0.02em] leading-[1.2] mb-3">
                {t('checkInbox')}
              </h1>
              <p className="font-interDisplay text-sm text-dusk leading-relaxed mb-8">
                {t('inboxMessage', { email })}
              </p>

              <button
                onClick={() => router.push('/login')}
                className="w-full bg-denimBlue hover:bg-[#5A7CAE] text-white font-interDisplay text-sm font-bold tracking-[0.06em] px-8 py-[15px] rounded-full transition-colors"
              >
                {t('backToSignInBtn')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                  setError(null);
                }}
                className="mt-3.5 font-interDisplay text-xs text-dusk hover:text-denimBlue transition-colors"
              >
                {t('tryDifferent')}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-[30px] text-center">
                <h1 className="font-display font-normal text-[32px] text-denim tracking-[0.02em] leading-[1.15]">
                  {t('heading')}
                </h1>
                <p className="font-interDisplay text-sm text-dusk mt-2 leading-relaxed">{t('subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
                <AuthInput
                  label={t('emailLabel')}
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />

                {error && <AuthErrorBox>{error}</AuthErrorBox>}

                <AuthSubmitButton loading={loading} loadingLabel={t('submitting')}>
                  {t('submit')}
                </AuthSubmitButton>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="font-interDisplay text-[13px] text-dusk hover:text-denimBlue transition-colors"
                >
                  {t('backToSignInLink')}
                </button>
              </div>
            </>
          )}
        </AuthCard>

        <div className="mt-6">
          <AuthContactLink />
        </div>
      </AuthLayout>
    </>
  );
}
