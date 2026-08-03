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
import { isInAppBrowser, isAndroid, BREAKOUT_TARGET, ANDROID_INTENT_URL } from '@/lib/in-app-browser';

// SS-562 §3/§5: this used to be a hardcoded English map — every OAuth
// error reached Spanish-speaking staff in English, the exact
// chrome-translated-content-not pattern SS-555 found on the Tools page.
// The strings now live in messages/{en,es}.json under
// auth.signIn.oauthErrors, keyed by the same callback error codes. The
// cookie-blocked and no-code copy is the spec's replacement: the old text
// told users to "allow cookies for this site", a remedy they cannot act
// on inside an in-app browser.
const OAUTH_ERROR_KEYS = new Set([
  'no-invite',
  'auth-callback-failed',
  'auth-link-failed',
  'cookie-blocked',
  'code-invalid',
  'code-exchange',
  'oauth-provider',
  'no-code',
]);

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
  const oauthErrorMessage = oauthError
    ? OAUTH_ERROR_KEYS.has(oauthError)
      ? t(`oauthErrors.${oauthError}`)
      : t('oauthErrorFallback')
    : null;

  // SS-562: shown only after the Google button is tapped inside an in-app
  // browser -- the page looks normal until the user chooses that path.
  const [showBreakout, setShowBreakout] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function copyBreakoutLink() {
    try {
      await navigator.clipboard.writeText(BREAKOUT_TARGET);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Clipboard API can be denied inside webviews -- fall back to the
      // widely-supported legacy path rather than failing silently.
      const el = document.createElement('textarea');
      el.value = BREAKOUT_TARGET;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  }

  async function handleGoogleSignIn() {
    // SS-562: Google refuses OAuth inside embedded webviews by policy, so
    // in an in-app browser the button hands off to the real browser
    // instead of starting OAuth in place. The button itself stays --
    // Racquel's ruling -- only its destination changes.
    if (isInAppBrowser()) {
      if (isAndroid()) {
        // Android: the intent URL opens Chrome directly. One tap.
        window.location.href = ANDROID_INTENT_URL;
        return;
      }
      // iOS has no programmatic escape from a webview -- show the
      // instruction with a copyable link instead.
      setShowBreakout(true);
      return;
    }
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

            {/* SS-562 iOS breakout notice. bg-mist with the standard card
                border, deliberately NOT red: nothing has failed, this is a
                handoff. Rendered only after the Google button is tapped
                inside an in-app browser. */}
            {showBreakout && (
              <div className="bg-mist border border-cardBorder rounded-xl2 px-4 py-3.5 text-left">
                <p className="font-interDisplay text-sm font-semibold text-denim">{t('breakoutTitle')}</p>
                <p className="font-interDisplay text-[13px] text-dusk mt-1.5">{t('breakoutLine1')}</p>
                <p className="font-interDisplay text-[13px] text-dusk mt-1">{t('breakoutLine2')}</p>
                <button
                  type="button"
                  onClick={copyBreakoutLink}
                  className="mt-2.5 inline-block text-[13px] font-semibold text-denim border border-brass/30 bg-card px-4 py-1.5 rounded-full hover:border-brass transition-colors"
                >
                  {linkCopied ? t('breakoutCopied') : t('breakoutCopyLink')}
                </button>
                <p className="font-interDisplay text-[12px] text-dusk mt-2.5">{t('breakoutAlsoEmail')}</p>
              </div>
            )}

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
