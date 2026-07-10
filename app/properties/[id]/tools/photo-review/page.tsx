// app/properties/[id]/tools/photo-review/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PhotoReviewClient from '@/components/PhotoReviewClient';

export default async function PhotoReviewPage({
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

  // Same owner/manager gate as app/properties/[id]/staff/page.tsx — bulk
  // room-photo assignment is a manager tool, staff shouldn't see it.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <PhotoReviewClient propertyId={id} />;
}
