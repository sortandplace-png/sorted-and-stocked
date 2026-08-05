// app/manager/page.tsx
// PHASE 1 -- deliberately not linked from DesktopNav/MobileBottomNav/
// CommandPalette. Reachable only by typing the URL directly, and gated
// server-side by is_platform_manager() below -- which will reject
// everyone (including Racquel) until 074_manager_platform_phase1.sql is
// actually applied and someone is seeded into platform_managers. Today,
// the RPC call itself will fail (function doesn't exist yet); that failure
// is treated as "not authorized" and redirects home, same as a real no.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ManagerDashboardClient from '@/components/ManagerDashboardClient';

// SS-681: authenticated, per-account, and must never be served from a
// static or revalidated render. Same rule as app/properties/[id]/layout.tsx;
// see the comment there for why this is set explicitly rather than relied
// upon as a side effect of reading cookies.
export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function ManagerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isManager, error } = await supabase.rpc('is_platform_manager');
  if (error || !isManager) redirect('/properties');

  // SS-519 audit: the one property list the SS-390 archive sweep missed --
  // without the filter the five archived test properties render here too.
  const { data: properties } = await supabase.from('properties').select('id, name').is('archived_at', null).order('name');

  return <ManagerDashboardClient properties={properties ?? []} />;
}
