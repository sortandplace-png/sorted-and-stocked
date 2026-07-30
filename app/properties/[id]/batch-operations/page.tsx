// app/properties/[id]/batch-operations/page.tsx
// Was 'use client' with a manual "Property ID" text field instead of the
// route's own [id] param, and no gate of any kind on the page itself --
// the API routes underneath it already enforce owner/manager (Tier 0 item
// 0.1), but the page rendered its full UI for every role regardless,
// including staff, who'd only discover the 403 after trying an action.
// Owner-only here, not owner+manager -- highest-risk tool in the app (bulk
// writes against recipe_ingredients with no per-row undo), against a real
// incident history (SS-001, 240 rows lost to an unidentified source).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BatchOperationsClient from '@/components/BatchOperationsClient';

export default async function BatchOperationsPage({
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
    .select('role, properties(name)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    redirect(`/properties/${id}/inventory`);
  }

  const propertyName = (membership.properties as unknown as { name: string } | null)?.name ?? '';

  return <BatchOperationsClient propertyId={id} propertyName={propertyName} />;
}
