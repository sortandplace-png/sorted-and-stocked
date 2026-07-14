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
    .select('property_id, role')
    .eq('user_id', user.id);

  // Staff don't land on Dashboard even via this old bookmarked route --
  // same My Day redirect as the real landing flow in /properties/page.tsx.
  if (memberships && memberships.length === 1) {
    const destination = memberships[0].role === 'staff' ? 'my-day' : 'dashboard';
    redirect(`/properties/${memberships[0].property_id}/${destination}`);
  }

  // No membership, or more than one property to choose from — send to the
  // picker rather than guess which property's dashboard was meant.
  redirect('/properties');
}
