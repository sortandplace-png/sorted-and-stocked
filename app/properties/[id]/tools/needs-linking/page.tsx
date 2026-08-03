// app/properties/[id]/tools/needs-linking/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOperatorConsole } from '@/lib/module-flags';
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
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  // SS-552: operator data-cleanup tool, operator_console only -- the tile
  // filter on the Tools hub hides the discovery path, this enforces the
  // route itself, same split as Suppliers.
  const hostFlags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(hostFlags)) {
    redirect(`/properties/${id}/tools`);
  }

  return <NeedsLinkingClient propertyId={id} />;
}
