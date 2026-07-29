// app/properties/[id]/tools/backup/page.tsx
// SS-092. Owner-only, gated here server-side AND inside the API route
// itself -- the same belt-and-suspenders pattern tools/suppliers and
// tools/tasks already use, so a direct link never renders a page whose
// only action would 403 anyway.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BackupDownloadClient from '@/components/BackupDownloadClient';

export default async function BackupPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Owner only -- stricter than the usual manager-included gate, matching
  // the API route's own check exactly.
  if (membership?.role !== 'owner') {
    redirect(`/properties/${id}/dashboard`);
  }

  return <BackupDownloadClient propertyId={id} />;
}
