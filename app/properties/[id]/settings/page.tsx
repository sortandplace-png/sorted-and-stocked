// app/properties/[id]/settings/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from '@/components/SettingsClient';
import StaffSlotsEditor from '@/components/StaffSlotsEditor';

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

  // Slot renaming is manager/owner only. Staff never see this section --
  // RLS would still allow the update (staff_slots_update_member is
  // member-scoped), so the gate here is the real control and should stay.
  const canManageSlots = membership.role === 'owner' || membership.role === 'manager';
  const { data: slots } = canManageSlots
    ? await supabase
        .from('staff_slots')
        .select('id, slot_number, label_en, label_es, active, user_id')
        .eq('property_id', id)
        .order('sort_order')
    : { data: null };

  return (
    <>
      <SettingsClient
        propertyId={id}
        role={membership.role}
        initialPhoneNumber={profile?.phone_number ?? ''}
        initialSmsOptIn={profile?.sms_opt_in ?? false}
      />
      {canManageSlots && (
        <div className="max-w-md lg:max-w-4xl mx-auto px-4 pb-8">
          <StaffSlotsEditor propertyId={id} initialSlots={slots ?? []} />
        </div>
      )}
    </>
  );
}
