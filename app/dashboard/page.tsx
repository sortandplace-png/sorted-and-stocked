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

  const { data: rawMemberships } = await supabase
    .from('property_members')
    .select('property_id, role, properties(archived_at)')
    .eq('user_id', user.id);

  // Archived properties are excluded, same rule as /properties/page.tsx and
  // the procurement surfaces (SS-519: a column exists to hide things and
  // several surfaces were not reading it). This route had NO archived
  // awareness at all, which meant a user whose single membership was an
  // archived test fixture got redirected straight into it, and a user with
  // one live property plus one archived one was sent to the picker instead
  // of landing on the only real house they have.
  const memberships = (rawMemberships ?? []).filter((m) => {
    const property = m.properties as unknown as { archived_at: string | null } | null;
    return property && !property.archived_at;
  });

  // Staff don't land on Dashboard even via this old bookmarked route --
  // same My Day redirect as the real landing flow in /properties/page.tsx.
  if (memberships.length === 1) {
    const destination = memberships[0].role === 'staff' ? 'my-day' : 'dashboard';
    redirect(`/properties/${memberships[0].property_id}/${destination}`);
  }

  // No membership, or more than one property to choose from — send to the
  // picker rather than guess which property's dashboard was meant.
  redirect('/properties');
}
