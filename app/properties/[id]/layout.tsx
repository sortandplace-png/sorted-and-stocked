// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/ui/AppHeader';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomNav from '@/components/nav/MobileBottomNav';
import StaffOnboardingModal from '@/components/StaffOnboardingModal';
import TrainingVideoOnboardingModal from '@/components/TrainingVideoOnboardingModal';
import { PropertyRoleProvider, type PropertyRole } from '@/components/PropertyRoleContext';
import { RetailerDefaultProvider } from '@/components/RetailerDefaultContext';
import Footer from '@/components/Footer';
import GlobalBackBar from '@/components/ui/GlobalBackBar';
import { getNextObservance } from '@/lib/get-next-observance';
import { formatPropertyLabel } from '@/lib/property-display';
import { isModuleEnabled, moduleForSegment } from '@/lib/module-flags';

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
    .select('role, properties(name, household_id, feature_flags, default_retailer, households(name))')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) redirect('/properties');

  const featureFlags = ((membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags ?? {}) as Record<string, unknown>;

  // x-pathname is stamped by lib/supabase/middleware.ts -- layouts don't
  // get the matched pathname as a prop the way page.tsx gets params, so
  // this is the only way to know which child route is actually being
  // rendered from here. Falls back to gating nothing if it's ever missing
  // (a stricter default would risk bouncing every page on a header that
  // failed to propagate for an unrelated reason).
  const pathname = (await headers()).get('x-pathname') ?? '';
  const afterPropertyId = pathname.split(`/properties/${id}/`)[1]?.split('?')[0] ?? '';
  const requiredModule = moduleForSegment(afterPropertyId);
  if (requiredModule && !isModuleEnabled(featureFlags, requiredModule)) {
    redirect(`/properties/${id}/dashboard`);
  }

  // Whether a household's name is shown at all depends on how many
  // properties it actually has -- not on whether this user happens to be a
  // member of more than one of them. Counted against the whole table so the
  // rule reflects the household's real shape, not this viewer's membership.
  const { data: allHouseholdIds } = await supabase.from('properties').select('household_id').not('household_id', 'is', null);
  const householdCounts = new Map<string, number>();
  for (const row of allHouseholdIds ?? []) {
    const hid = row.household_id as string;
    householdCounts.set(hid, (householdCounts.get(hid) ?? 0) + 1);
  }
  function household(h: { household_id: string | null; households: { name: string } | null } | null) {
    if (!h?.household_id || !h.households?.name) return null;
    return { name: h.households.name, propertyCount: householdCounts.get(h.household_id) ?? 1 };
  }

  const membershipProperty = membership.properties as unknown as {
    name: string;
    household_id: string | null;
    households: { name: string } | null;
  } | null;
  const propertyName = formatPropertyLabel(membershipProperty?.name ?? '', household(membershipProperty));

  // All properties this user belongs to, for the switcher -- not just the
  // one from the membership check above.
  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name, household_id, archived_at, households(name))')
    .eq('user_id', user.id);

  const switcherProperties = (allMemberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          archived_at: string | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is { id: string; name: string; household_id: string | null; archived_at: string | null; households: { name: string } | null } =>
        p !== null && !p.archived_at
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
    .map((p) => ({ id: p.id, label: formatPropertyLabel(p.name, household(p)) }));

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, staff_onboarding_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  const showStaffOnboarding = membership.role === 'staff' && !profile?.staff_onboarding_seen_at;

  const nextObservance = await getNextObservance();

  const defaultRetailer = (membership.properties as unknown as { default_retailer?: string | null } | null)
    ?.default_retailer;

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <RetailerDefaultProvider value={defaultRetailer}>
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
          <DesktopNav propertyId={id} role={membership.role as PropertyRole} flags={featureFlags} />
        </div>
        <main className="pb-20 md:pb-0">
          {/* SS-412: every page gets a way back, from the layout, so no
              future page can ship stranded. Hidden on the dashboard. */}
          <GlobalBackBar propertyId={id} />
          {children}
          <Footer propertyId={id} />
        </main>
        <MobileBottomNav propertyId={id} role={membership.role as PropertyRole} flags={featureFlags} />
        {showStaffOnboarding && (
          <StaffOnboardingModal propertyId={id} propertyName={propertyName} userId={user.id} />
        )}
        {/* SS-364: not shown alongside the staff welcome tour above -- a
            brand-new staff member's first session is that tour, not a
            second competing modal on top of it. Starts from their next
            session, once staff_onboarding_seen_at is set. Owner/manager,
            who never see the tour, get it from their very first session. */}
        {!showStaffOnboarding && (
          <TrainingVideoOnboardingModal userId={user.id} role={membership.role as PropertyRole} />
        )}
      </div>
      </RetailerDefaultProvider>
    </PropertyRoleProvider>
  );
}
