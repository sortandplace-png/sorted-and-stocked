// app/properties/[id]/tools/duty-roster/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DutyRosterEditor from '@/components/DutyRosterEditor';

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

  // Same access tier as /staff: owner/manager only, staff redirected out
  // before they ever see the screen. RLS (migration 104) is the real
  // enforcement -- this is belt-and-suspenders, same as every other
  // admin-only page in the app.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  const { data: templates } = await supabase
    .from('staff_duty_templates')
    .select('id, area_en, area_es, task_en, task_es, staff_roster_key, job_type, sort_order')
    .eq('property_id', id)
    .order('area_en')
    .order('sort_order');

  return <DutyRosterEditor propertyId={id} initialRows={templates ?? []} />;
}
