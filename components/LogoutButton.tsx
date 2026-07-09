// components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const router = useRouter();

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
      Sign out
    </button>
  );
}
