// app/procurement/layout.tsx
// SS-126 proof case. Procurement is genuinely cross-property -- it stitches
// every property the viewer manages into one view -- so it has no propertyId
// and cannot live under app/properties/[id]/. That is precisely why it
// rendered with no header and stranded anyone who followed the More menu here.
//
// AppHeader with no propertyId: the switcher reads "All Properties", and
// search is hidden rather than silently scoped to one property (SS-249).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/ui/AppHeader';
import CrossHouseNav from '@/components/nav/CrossHouseNav';
import { getNextObservance } from '@/lib/get-next-observance';
import { buildSwitcherProperties } from '@/lib/property-display';

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name, household_id, archived_at, feature_flags, households(name))')
    .eq('user_id', user.id);

  // Household size counted against the whole table, not just this user's
  // own memberships -- see app/properties/[id]/layout.tsx for why.
  // SS-459: same shared implementation as the property layout; the inline
  // copy that lived here is exactly the drift the helper exists to stop.
  const switcherProperties = buildSwitcherProperties(
    (allMemberships ?? [])
      .map(
        (m) =>
          m.properties as unknown as {
            id: string;
            name: string;
            household_id: string | null;
            archived_at: string | null;
            feature_flags: Record<string, unknown> | null;
            households: { name: string } | null;
          } | null
      )
      .filter((p): p is NonNullable<typeof p> => p !== null && !p.archived_at)
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const nextObservance = await getNextObservance();

  return (
    <div className="min-h-screen bg-linen">
      <AppHeader
        properties={switcherProperties}
        userId={user.id}
        userEmail={user.email}
        fullName={profile?.full_name}
        avatarUrl={profile?.avatar_url}
        observance={nextObservance}
      />
      {/* No DesktopNav or MobileBottomNav: both are property-scoped and take a
          propertyId. The switcher is the way back into a property from here.
          SS-257 (ruled): cross-house pages get their OWN slim nav instead --
          cross-house destinations only. */}
      <CrossHouseNav />
      <main className="pb-20 md:pb-0">{children}</main>
    </div>
  );
}
