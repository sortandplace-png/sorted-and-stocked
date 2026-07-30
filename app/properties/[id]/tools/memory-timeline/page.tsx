// app/properties/[id]/tools/memory-timeline/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HomeMemoryTimelineClient from '@/components/HomeMemoryTimelineClient';

export default async function MemoryTimelinePage({
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

  // Reachable by any role by direct URL despite having no Tools Hub tile
  // at all (hidden pending a build-or-kill decision) -- the client
  // component's own write form already only renders for owner/manager, but
  // nothing stopped staff from viewing family photos/memories at the page
  // level. Personal/family content, not an operational tool -- gated to
  // match its own write-side gate rather than leaving read access open.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <HomeMemoryTimelineClient propertyId={id} />;
}
