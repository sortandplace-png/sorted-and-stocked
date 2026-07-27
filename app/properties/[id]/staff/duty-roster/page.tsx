// app/properties/[id]/staff/duty-roster/page.tsx
// Unified Staff Duty Roster. Owner/manager only -- staff consume duties on
// My Day, they don't assign them.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';

export default async function DutyRosterPage({
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

  // Same belt-and-suspenders gate as the staff page: RLS would block the
  // writes anyway, but staff shouldn't reach a screen they can't use.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <DutyRosterClient propertyId={id} />;
}
