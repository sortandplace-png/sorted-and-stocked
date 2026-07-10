// components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const router = useRouter();
  const t = useTranslations('common');

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={`text-sm underline ${variant === 'dark' ? 'text-cream/80' : 'text-charcoal/60'}`}
    >
      {t('signOut')}
    </button>
  );
}
