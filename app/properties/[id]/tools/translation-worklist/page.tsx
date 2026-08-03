// app/properties/[id]/tools/translation-worklist/page.tsx
// SS-552: this route previously had NO gate at all -- no auth check, no
// role check -- so any member of the property, including staff, could
// reach a bulk-mutation operator tool by direct URL. Now guarded the same
// way as the other routed cleanup tools (duplicate-ingredients,
// needs-linking): signed-in, manager-or-above, and operator_console only.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOperatorConsole } from '@/lib/module-flags';
import TranslationWorklistClient from '@/components/TranslationWorklistClient';

export default async function TranslationWorklistPage({ params }: { params: Promise<{ id: string }> }) {
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

  // No membership row is treated as the least privileged, not the most.
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

  return <TranslationWorklistClient propertyId={id} />;
}
