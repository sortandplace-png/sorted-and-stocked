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

export default async function ManagerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isManager, error } = await supabase.rpc('is_platform_manager');
  if (error || !isManager) redirect('/properties');

  const { data: properties } = await supabase.from('properties').select('id, name').order('name');

  return <ManagerDashboardClient properties={properties ?? []} />;
}
