// app/procurement/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProcurementClient from '@/components/ProcurementClient';

export default async function ProcurementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Only owner/manager memberships — staff shop for one property at a time
  // from that property's own shopping list, they don't need the stitched
  // multi-property view.
  const { data: memberships, error } = await supabase
    .from('property_members')
    .select('role, properties(id, name, household_id, households(name))')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager']);

  const properties = (memberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is { id: string; name: string; household_id: string | null; households: { name: string } | null } =>
        p !== null
    )
    .map((p) => ({ id: p.id, name: p.name, householdName: p.households?.name ?? null }));

  if (properties.length === 0) redirect('/properties');

  return <ProcurementClient properties={properties} errorMessage={error?.message} />;
}
