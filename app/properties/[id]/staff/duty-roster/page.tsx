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

  // SS-156 Phase 2: DutyRosterClient no longer carries its own container,
  // because inside the Task Center tabs that wrapper is what made the page
  // change width and colour on every tab switch. This route still exists
  // for anyone with it bookmarked, so it supplies the same frame itself --
  // identical background and max-width to TaskCenterTabs, so the roster
  // looks the same whichever door you came through.
  //
  // The stat tiles are deliberately NOT reproduced here. They live above
  // the tabs now; this standalone view is the roster alone.
  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6">
        <DutyRosterClient propertyId={id} />
      </div>
    </div>
  );
}
