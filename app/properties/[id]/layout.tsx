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
import { buildSwitcherProperties } from '@/lib/property-display';
import { isModuleEnabled, moduleForSegment, isOperatorConsole } from '@/lib/module-flags';

// SS-681. Every authenticated page under /properties/[id] renders fresh.
//
// Set HERE rather than on ~30 individual page files, because the failure
// mode is a page that forgets to opt in: the Register carried a comment
// asserting "no caching: auth cookies already force dynamic rendering"
// and still served a render from hours earlier. Segment config on a
// layout applies to every nested route, so a page added tomorrow inherits
// it without anyone remembering.
//
// force-dynamic is belt and braces: reading cookies through
// lib/supabase/server already opts these routes into dynamic rendering,
// so this changes nothing today. It exists to make that guarantee
// EXPLICIT and to stop a future refactor (a page that stops reading
// cookies, an added generateStaticParams) from silently reintroducing a
// static or revalidated render. revalidate = 0 forbids ISR outright.
//
// The measured staleness was NOT route config, it was the service worker
// caching navigations and Supabase REST reads (next.config.js). Both are
// fixed there. This is the second half of the same rule.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

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

  // SS-459 label rule needs only the names -- the whole-table property
  // count this block used to fetch (SS-359's size-based rule) is gone, and
  // with it one DB roundtrip per page render.
  const membershipProperty = membership.properties as unknown as {
    name: string;
    household_id: string | null;
    households: { name: string } | null;
  } | null;
  const propertyName = formatPropertyLabel(membershipProperty?.name ?? '', membershipProperty?.households);

  // All properties this user belongs to, for the switcher -- not just the
  // one from the membership check above.
  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name, household_id, archived_at, feature_flags, households(name))')
    .eq('user_id', user.id);

  // SS-459: ordering, labels and the console accent all come from the ONE
  // shared implementation -- this layout and procurement's used to inline
  // near-identical copies of this, which is how two surfaces came to
  // disagree about what a house is called.
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
    .select('full_name, avatar_url, staff_onboarding_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  const showStaffOnboarding = membership.role === 'staff' && !profile?.staff_onboarding_seen_at;

  const nextObservance = await getNextObservance();

  const defaultRetailer = (membership.properties as unknown as { default_retailer?: string[] | null } | null)
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
          // Sole route home since the bottom nav lost its Home tab: staff
          // land on My Day, everyone else on the dashboard -- the same
          // role split the property picker already applies.
          homeSegment={membership.role === 'staff' ? 'my-day' : 'dashboard'}
          // SS-567: mirrors the console route's own gate exactly, so search
          // never offers a destination that would redirect on click.
          canReachConsole={isOperatorConsole(featureFlags) && membership.role !== 'staff'}
        />
        <div className="sticky top-[60px] z-20">
          <DesktopNav propertyId={id} role={membership.role as PropertyRole} flags={featureFlags} />
        </div>
        {/* Bottom padding = bar height (~56px) + breathing room + the
            iPhone home-indicator inset the bar itself also pads by, so
            the last cards on scroll-heavy pages (inventory rooms, All
            Items, shopping list, recipes, My Day) can never end hidden
            behind the fixed bar. */}
        <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
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
