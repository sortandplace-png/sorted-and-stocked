// app/properties/[id]/staff/hours/page.tsx
// SS-285 manager view: hours by person by week. Owner/manager only --
// staff clock themselves in and out on My Day, they don't review the
// property's timesheet.
//
// Same belt-and-suspenders gate as Duty Roster: shifts_read RLS actually
// allows any property member to read the property's shifts, so this
// redirect is what stops a staff member landing on a screen showing
// everyone's hours. Worth knowing if that policy is ever revisited --
// the restriction lives here, not in the database.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ShiftHoursClient from '@/components/ShiftHoursClient';

export default async function ShiftHoursPage({
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

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return (
    <div className="bg-mist min-h-screen p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-display text-denim mb-1">Hours</h1>
        <p className="text-sm text-dusk mb-5">
          Clocked hours by person, by week. Corrections are made directly in Supabase for now.
        </p>
        <ShiftHoursClient propertyId={id} />
      </div>
    </div>
  );
}
