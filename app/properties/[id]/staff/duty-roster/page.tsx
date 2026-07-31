// app/properties/[id]/staff/duty-roster/page.tsx
// Bookmark-compat mount of the Task Center. Same SS-410 operator gate as
// /tools/tasks -- the Task Center exists only on the console property and
// is cross-house there (Racquel's 31 Jul ruling). Kept as a real mount
// rather than deleted (R21); anyone holding the old URL on a non-console
// property lands on their dashboard.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';
import { isOperatorConsole } from '@/lib/module-flags';
import { getOperatorProperties } from '@/lib/operator-properties';

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

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  const properties = await getOperatorProperties(supabase, user.id);

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6">
        <DutyRosterClient propertyId={id} properties={properties} />
      </div>
    </div>
  );
}
