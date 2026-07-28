// app/properties/[id]/tools/tasks/page.tsx
// Staff Task Center. Manager-only since 2026-07-20: task_assignments RLS locks
// task visibility to own-assignments-only per staff member, so a shared board
// is something only a manager can meaningfully see.
//
// SS-241: this route had NO server guard. It awaited params and rendered the
// client, relying on RLS alone, while DesktopNav and MobileBottomNav both
// listed it managerOnly -- and MobileBottomNav's comment claimed managerOnly
// "mirrors each page's own server-side gate". For this route that was false.
// Same pattern as staff/duty-roster/page.tsx, which did have the guard.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffTasksClient from '@/components/StaffTasksClient';

export default async function StaffTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  // No membership row is treated as the least privileged, not the most.
  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <StaffTasksClient propertyId={id} />;
}
