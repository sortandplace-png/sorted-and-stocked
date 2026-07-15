// app/properties/[id]/staff/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffClient from '@/components/StaffClient';

export default async function StaffPage({
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

  // Parent layout already confirmed membership; this page additionally
  // requires owner/manager. Belt-and-suspenders with the RLS policies on
  // property_members, which would block the actual writes regardless —
  // but staff shouldn't even see this screen, let alone hit a wall inside it.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  const { data: property } = await supabase.from('properties').select('name').eq('id', id).maybeSingle();

  return <StaffClient propertyId={id} propertyName={property?.name ?? ''} />;
}
