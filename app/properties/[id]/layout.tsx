// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/ui/AppHeader';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomNav from '@/components/nav/MobileBottomNav';
import StaffOnboardingModal from '@/components/StaffOnboardingModal';
import { PropertyRoleProvider, type PropertyRole } from '@/components/PropertyRoleContext';
import Footer from '@/components/Footer';
import { getNextObservance } from '@/lib/get-next-observance';
import { formatPropertyLabel } from '@/lib/property-display';

export default async function PropertyLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already blocks unauthenticated requests, but that check is
  // path-based, not membership-based — it doesn't know which properties
  // this user is actually allowed in. Confirm membership here so someone
  // can't casually browse another household's property by guessing/typing
  // a UUID (RLS would block their data queries either way, but a redirect
  // to the picker is a cleaner experience than a page full of empty lists).
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(name, household_id, households(name))')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) redirect('/properties');

  const membershipProperty = membership.properties as unknown as {
    name: string;
    household_id: string | null;
    households: { name: string } | null;
  } | null;
  const propertyName = formatPropertyLabel(
    membershipProperty?.name ?? '',
    membershipProperty?.households?.name
  );

  // All properties this user belongs to, for the switcher -- not just the
  // one from the membership check above.
  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name, household_id, households(name))')
    .eq('user_id', user.id);

  const switcherProperties = (allMemberships ?? [])
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
    // Group by household so sibling properties sort adjacent; properties
    // with no household sort after ones that have one, then by name.
    .sort((a, b) => {
      const aHousehold = a.households?.name ?? null;
      const bHousehold = b.households?.name ?? null;
      if (aHousehold !== bHousehold) {
        if (aHousehold === null) return 1;
        if (bHousehold === null) return -1;
        return aHousehold.localeCompare(bHousehold);
      }
      return a.name.localeCompare(b.name);
    })
    .map((p) => ({ id: p.id, name: p.name, householdName: p.households?.name ?? null }));

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, staff_onboarding_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  const showStaffOnboarding = membership.role === 'staff' && !profile?.staff_onboarding_seen_at;

  const nextObservance = await getNextObservance();

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <div className="min-h-screen bg-linen">
        {/* Shared chrome (header + DesktopNav below) -- migrated to Concept B
            (denim/brass/mist/linen) per the app-wide palette reversal. The
            root page background above stays bg-linen on purpose: page
            bodies not yet migrated (Plan, Staff, Inventory, etc.) rely on
            it as their backdrop, and changing it here would expose a
            mismatched strip behind any page that doesn't paint its own
            full-bleed background. Only the bars themselves, which carry
            their own explicit background regardless of what's behind them,
            move to Concept B in this pass. */}
        {/* Extracted to components/ui/AppHeader (SS-126) so routes outside
            this segment can render the same chrome. One implementation. */}
        <AppHeader
          propertyId={id}
          propertyName={propertyName}
          properties={switcherProperties}
          userId={user.id}
          userEmail={user.email}
          fullName={profile?.full_name}
          avatarUrl={profile?.avatar_url}
          observance={nextObservance}
        />
        <div className="sticky top-[60px] z-20">
          <DesktopNav propertyId={id} role={membership.role as PropertyRole} />
        </div>
        <main className="pb-20 md:pb-0">
          {children}
          <Footer propertyId={id} />
        </main>
        <MobileBottomNav propertyId={id} role={membership.role as PropertyRole} />
        {showStaffOnboarding && (
          <StaffOnboardingModal propertyId={id} propertyName={propertyName} userId={user.id} />
        )}
      </div>
    </PropertyRoleProvider>
  );
}
