// app/properties/[id]/settings/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from '@/components/SettingsClient';

export default async function SettingsPage({
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
  if (!membership) redirect('/properties');

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number, sms_opt_in')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <SettingsClient
      propertyId={id}
      role={membership.role}
      initialPhoneNumber={profile?.phone_number ?? ''}
      initialSmsOptIn={profile?.sms_opt_in ?? false}
    />
  );
}
