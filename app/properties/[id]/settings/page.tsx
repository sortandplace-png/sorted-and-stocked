// app/properties/[id]/settings/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from '@/components/SettingsClient';
import StaffSlotsEditor from '@/components/StaffSlotsEditor';
import { isOperatorConsole } from '@/lib/module-flags';

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
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) redirect('/properties');

  // SS-856: on the operator-console property, Settings is a SECTION of the
  // console page (Configuration), not its own destination -- and staff
  // slots there now live in the console's People house-tile picker
  // (SS-824), so this standalone page is a duplicate door on Lax
  // specifically. Client houses (no console) keep this page as their real,
  // only destination for phone/SMS and staff slots -- unaffected.
  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (isOperatorConsole(flags)) {
    redirect(`/properties/${id}/console#configuration`);
  }

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

  // SS-243: this property's own members (the picker's candidate list) and
  // their contact info -- the non-console properties (Main, Country, Low,
  // Henderson, QA Demo) manage staff slots here, not on the operator
  // console, so the connector has to work on both surfaces, not just Lax's.
  let members: { user_id: string; name: string; role: string }[] = [];
  const assignedNames: Record<string, string> = {};
  const contactByUserId: Record<string, { phone: string | null; email: string | null }> = {};
  const weekMinutesByUser: Record<string, number> = {};
  if (canManageSlots) {
    const { data: memberRows } = await supabase
      .from('property_members')
      .select('user_id, role, profiles(full_name, email, phone_number)')
      .eq('property_id', id);
    members = (memberRows ?? [])
      .map((m) => {
        const prof = m.profiles as unknown as { full_name: string | null; email: string | null; phone_number: string | null } | null;
        const name = (prof?.full_name?.trim() || prof?.email || '(no account details)') as string;
        assignedNames[m.user_id as string] = name;
        contactByUserId[m.user_id as string] = { phone: prof?.phone_number ?? null, email: prof?.email ?? null };
        return { user_id: m.user_id as string, name, role: m.role as string };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Manager at a Glance: this week's worked minutes for whoever is
    // actually linked into a slot -- same Monday-start-week, closed-shifts
    // rule as ClockInOutButton/ShiftHoursClient.
    const linkedUserIds = (slots ?? []).map((s) => s.user_id).filter((v): v is string => !!v);
    if (linkedUserIds.length > 0) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const { data: shiftRows } = await supabase
        .from('shifts')
        .select('user_id, clocked_in_at, clocked_out_at')
        .eq('property_id', id)
        .in('user_id', linkedUserIds)
        .gte('clocked_in_at', weekStart.toISOString())
        .not('clocked_out_at', 'is', null);
      for (const s of shiftRows ?? []) {
        const mins = Math.max(
          0,
          (new Date(s.clocked_out_at as string).getTime() - new Date(s.clocked_in_at as string).getTime()) / 60000
        );
        weekMinutesByUser[s.user_id as string] = Math.round((weekMinutesByUser[s.user_id as string] ?? 0) + mins);
      }
    }
  }

  return (
    <>
      <SettingsClient
        propertyId={id}
        role={membership.role}
        initialPhoneNumber={profile?.phone_number ?? ''}
        initialSmsOptIn={profile?.sms_opt_in ?? false}
        readAt={new Date().toISOString()}
      />
      {canManageSlots && (
        <div className="max-w-md lg:max-w-4xl mx-auto px-4 pb-8">
          <StaffSlotsEditor
            propertyId={id}
            initialSlots={slots ?? []}
            assignedNames={assignedNames}
            members={members}
            weekMinutesByUser={weekMinutesByUser}
            contactByUserId={contactByUserId}
            myDayHref={`/properties/${id}/my-day`}
          />
        </div>
      )}
    </>
  );
}
