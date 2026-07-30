// app/properties/[id]/print-labels/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrintLabelsClient from '@/components/PrintLabelsClient';

export default async function PrintLabelsPage({
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

  // Was reachable and fully functional for any role by direct URL despite
  // the sitemap's own MANAGER_ONLY_HREFS already listing this route --
  // that list only ever controlled a link's visibility, never enforced
  // anything. Gate now matches the intent that list already documented.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <PrintLabelsClient propertyId={id} />;
}
