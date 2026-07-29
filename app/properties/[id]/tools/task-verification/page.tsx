// app/properties/[id]/tools/task-verification/page.tsx
// SS-269 (minimal scope). Owner/manager only, same gate as tools/tasks and
// staff/duty-roster -- this is a review tool, not something staff complete
// work through.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TaskVerificationClient from '@/components/TaskVerificationClient';

export default async function TaskVerificationPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="bg-linen min-h-screen">
      <TaskVerificationClient propertyId={id} />
    </div>
  );
}
