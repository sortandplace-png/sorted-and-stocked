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
//
// SS-156 Phase 2: one central page, not two tabs. The roster's own
// structure IS the manager's view -- stat tiles, filters, tile grid by
// room -- so it is the page, with Task Center's genuinely managerial
// pieces folded onto the same grid (deploy-from-library, SOP panel, task
// photos). "Roster" and "Tasks" are no longer separate concepts.
//
// What deliberately did NOT come across: the Due badge and the completion
// checkbox. Staff complete work on My Day, which reads this same data
// through scope="mine" and is untouched. This page is for assigning and
// managing, not checking off.
//
// The guard below is unchanged and correct for both -- staff/duty-roster
// enforces the identical owner/manager gate, so nothing is newly exposed.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';
import ShiftHoursClient from '@/components/ShiftHoursClient';

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

  // Page owns the chrome: bg-linen and the 1240px container, the roster's
  // real, correct frame. Same frame on staff/duty-roster, so the page looks
  // identical whichever door you came through.
  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6">
        <DutyRosterClient propertyId={id} />

        {/* Hours moved here from its own nav destination. This is the right
            home for it: "everyone, by week" is a manager question, and this
            page already carries the owner/manager gate that answer needs --
            the guard above is what makes a second one unnecessary.
            My Day keeps the staff-facing half ("me, this week") on the Time
            Clock tile; the two read the same shifts table and use the same
            Monday-start week, so they cannot disagree.
            The id is the anchor /staff/hours redirects to. */}
        <section id="hours" className="mt-8 scroll-mt-6">
          <ShiftHoursClient propertyId={id} showHeading />
        </section>
      </div>
    </div>
  );
}
