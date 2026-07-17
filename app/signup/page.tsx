// app/signup/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SITE_URL } from '@/lib/site-url';
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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const t = useTranslations('auth.signUp');
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [householdName, setHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const router = useRouter();

  // Real Google OAuth -- the same call login's button already uses. The
  // backend doesn't distinguish "login intent" vs "signup intent" for
  // OAuth: app/auth/callback/route.ts applies the same no-property-
  // membership-means-signed-back-out gate regardless of which page the
  // click came from, so surfacing this button here is genuinely just
  // surfacing it, not a second auth path to secure separately.
  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setConfirmError(t('passwordMismatch'));
      return;
    }
    setConfirmError(null);
    setLoading(true);
    setError(null);

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), email: email.trim(), password, householdName: householdName.trim() }),
    });
    const result = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(result.error ?? t('genericError'));
      return;
    }

    // Account + household + property now exist -- sign straight in rather
    // than sending them to /login to type what they just typed again.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) {
      // Account creation itself succeeded -- a sign-in hiccup right after
      // shouldn't strand them with no path forward.
      router.push('/login');
      return;
    }
    router.push('/properties');
    router.refresh();
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
          <div className="mb-[30px] text-center">
            <h1 className="font-display font-normal text-[32px] text-denim tracking-[0.02em] leading-[1.15]">
              {t('heading')}
            </h1>
            <p className="font-interDisplay text-sm text-dusk mt-2">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Real required fields (signup code + household name), not
                Figma's first/last name -- the mockup has no backend and no
                concept of the invite-code gate this app actually uses, so
                its two-name-field layout doesn't map onto what
                /api/signup actually needs. Kept the real fields, just
                restyled to the new AuthInput look. */}
            <AuthInput
              label={t('codeLabel')}
              id="signup-code"
              type="text"
              placeholder={t('codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <AuthInput
              label={t('householdLabel')}
              id="signup-household"
              type="text"
              placeholder={t('householdPlaceholder')}
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              required
            />
            <AuthInput
              label={t('emailLabel')}
              id="signup-email"
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
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              minLength={6}
              required
            />
            <AuthInput
              label={t('confirmPasswordLabel')}
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              error={confirmError ?? undefined}
              minLength={6}
              required
            />

            <AuthOrDivider label={t('or')} />

            <AuthGoogleButton onClick={handleGoogleSignUp} disabled={googleLoading}>
              {googleLoading ? t('googleSigningUp') : t('googleSignUp')}
            </AuthGoogleButton>

            {error && <AuthErrorBox>{error}</AuthErrorBox>}

            <AuthSubmitButton loading={loading} loadingLabel={t('submitting')}>
              {t('submit')}
            </AuthSubmitButton>
          </form>

          <div className="mt-7 pt-6 text-center border-t border-cardBorder">
            <span className="font-interDisplay text-[13px] text-dusk">{t('alreadyHaveAccount')} </span>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="font-interDisplay text-[13px] font-semibold text-denimBlue hover:underline"
            >
              {t('signInLink')}
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
