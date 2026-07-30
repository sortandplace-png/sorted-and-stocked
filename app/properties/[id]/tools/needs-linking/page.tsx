// app/properties/[id]/tools/needs-linking/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NeedsLinkingClient from '@/components/NeedsLinkingClient';

export default async function NeedsLinkingPage({
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

  // Reachable and fully functional for any role by direct URL despite the
  // Tools Hub tile already being hidden from staff -- that hid the
  // discovery path, not the route itself. Bulk-links ingredient names to
  // inventory items across every recipe on the property.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <NeedsLinkingClient propertyId={id} />;
}
