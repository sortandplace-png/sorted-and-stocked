// app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthWordmark from '@/components/auth/AuthWordmark';
import AuthInput from '@/components/auth/AuthInput';
import AuthOrDivider from '@/components/auth/AuthOrDivider';
import AuthGoogleButton from '@/components/auth/AuthGoogleButton';
import AuthErrorBox from '@/components/auth/AuthErrorBox';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthContactLink from '@/components/auth/AuthContactLink';
import LocaleToggle from '@/components/LocaleToggle';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'no-invite': "No account found for that Google sign-in — you'll need an invite first.",
  'auth-callback-failed': 'Sign-in failed. Please try again.',
  'auth-link-failed': "That link didn't work or has expired — request a new one and try again.",
};

function LoginForm() {
  const t = useTranslations('auth.signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');
  const oauthErrorMessage = oauthError ? OAUTH_ERROR_MESSAGES[oauthError] ?? 'Sign-in failed. Please try again.' : null;

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    // Gated the same way as invite-code signup: app/auth/callback/route.ts
    // signs the user back out after the redirect if this account has no
    // property_members row, so a stray Google email can't self-provision
    // its way into the app.
    //
    // window.location.origin, not SITE_URL -- this redirect completes
    // synchronously in the same browser session (unlike an emailed reset/
    // invite link, which may be opened later from anywhere), so there's no
    // localhost-leak risk to guard against here. Using the fixed SITE_URL
    // was the actual bug: a Google sign-in started on app.sortandplace.com
    // always landed back on www.sortandplace.com instead, confirmed live.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // "Remember me" is on by default — sessions already persist across
    // restarts normally. Unchecking it means: sign out automatically the
    // next time this browser/tab is closed, rather than staying signed in
    // indefinitely. This is a real, honest behavior, not a cosmetic toggle
    // -- kept even though the finished Figma design doesn't model it, since
    // dropping it would be removing real functionality to match a mockup
    // that simply never needed to represent it.
    if (!rememberMe) {
      sessionStorage.setItem('sortedandstocked_no_remember', '1');
    } else {
      sessionStorage.removeItem('sortedandstocked_no_remember');
    }
    // Always /properties, never a preserved deep-link -- Dashboard (or the
    // properties picker, for a multi-household account) should be the
    // universal landing spot after signing in, no exceptions. Previously
    // restored whatever page the middleware had bounced the user from
    // (via a ?redirectTo= param), which is how a login could land back on
    // a scrolled-mid-page Tools view instead.
    router.push('/properties');
    router.refresh();
  }

  const displayError = error ?? oauthErrorMessage;

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
          <div className="mb-[30px] text-center">
            <h1 className="font-display font-normal text-[32px] text-denim tracking-[0.02em] leading-[1.15]">
              {t('heading')}
            </h1>
            <p className="font-interDisplay text-sm text-dusk mt-2">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            <AuthInput
              label={t('emailLabel')}
              id="signin-email"
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
            <AuthInput
              label={t('passwordLabel')}
              id="signin-password"
              type="password"
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              required
            />

            <div className="flex items-center justify-between -mt-1.5">
              <label className="flex items-center gap-2 text-sm text-dusk">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-denimBlue rounded"
                />
                {t('rememberMe')}
              </label>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-[12px] tracking-[0.02em] hover:underline"
                style={{ color: '#C6A46E' }}
              >
                {t('forgotPassword')}
              </button>
            </div>

            <AuthOrDivider label={t('or')} />

            <AuthGoogleButton onClick={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading ? t('googleSigningIn') : t('googleSignIn')}
            </AuthGoogleButton>

            {displayError && <AuthErrorBox>{displayError}</AuthErrorBox>}

            <AuthSubmitButton loading={loading} loadingLabel={t('submitting')}>
              {t('submit')}
            </AuthSubmitButton>
          </form>

          <div className="mt-7 pt-6 text-center border-t border-cardBorder">
            <span className="font-interDisplay text-[13px] text-dusk">{t('newHere')} </span>
            <button
              type="button"
              onClick={() => router.push('/signup')}
              className="font-interDisplay text-[13px] font-semibold text-denimBlue hover:underline"
            >
              {t('createAnAccount')}
            </button>
          </div>
        </AuthCard>

        <div className="mt-6">
          <AuthContactLink />
        </div>
      </AuthLayout>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
