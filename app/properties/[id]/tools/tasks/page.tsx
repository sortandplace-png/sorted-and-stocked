// app/properties/[id]/tools/tasks/page.tsx
// The Task Center -- SS-410, Racquel's 31 Jul ruling: it exists ONLY on the
// operator console (feature_flags.operator_console -- Lax today) and is
// CROSS-HOUSE there, showing every task across every property the operator
// belongs to, filtered by house. Main's own Task Center disappearing is
// intended: the console shows Main's tasks. Server-side gate, not a hidden
// nav tile (SS-381's lesson).
//
// SS-241's original owner/manager guard stays underneath the operator
// gate -- staff on the console property still bounce to inventory.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';
import ShiftHoursClient from '@/components/ShiftHoursClient';
import { isOperatorConsole } from '@/lib/module-flags';
import { getOperatorProperties } from '@/lib/operator-properties';

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
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  // No membership row is treated as the least privileged, not the most.
  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  // Every property the operator manages, labelled household + property
  // ("Strauss Main" -- asked three times), archived ones excluded.
  const properties = await getOperatorProperties(supabase, user.id);

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6">
        <DutyRosterClient propertyId={id} properties={properties} />

        {/* Hours stays console-scoped: "everyone, by week" for the console
            property's own shifts. The id is the anchor /staff/hours
            redirects to. */}
        <section id="hours" className="mt-8 scroll-mt-6">
          <ShiftHoursClient propertyId={id} showHeading />
        </section>
      </div>
    </div>
  );
}
