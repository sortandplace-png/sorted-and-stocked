// app/dashboard/page.tsx
// Dashboard now lives at /properties/[id]/dashboard (moved so it inherits
// the real header/nav — see the property layout). This bare route is a
// thin redirect for anyone hitting the old bookmarked/typed URL directly,
// same pattern /properties/page.tsx already uses for single-property
// households.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardRedirect() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('property_members')
    .select('property_id')
    .eq('user_id', user.id);

  if (memberships && memberships.length === 1) {
    redirect(`/properties/${memberships[0].property_id}/dashboard`);
  }

  // No membership, or more than one property to choose from — send to the
  // picker rather than guess which property's dashboard was meant.
  redirect('/properties');
}
