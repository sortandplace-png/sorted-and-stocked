// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomNav from '@/components/nav/MobileBottomNav';
import LogoutButton from '@/components/LogoutButton';
import HeaderAvatarUpload from '@/components/HeaderAvatarUpload';
import CommandPalette from '@/components/CommandPalette';
import CommandPaletteTrigger from '@/components/CommandPaletteTrigger';
import AskTheHouseClient from '@/components/AskTheHouseClient';
import StaffOnboardingModal from '@/components/StaffOnboardingModal';
import { LogoMark } from '@/components/Logo';
import LocaleToggle from '@/components/LocaleToggle';
import { PropertyRoleProvider, type PropertyRole } from '@/components/PropertyRoleContext';
import PropertySwitcher from '@/components/PropertySwitcher';
import Footer from '@/components/Footer';
import { getNextObservance } from '@/lib/get-next-observance';

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
    .select('role, properties(name)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) redirect('/properties');

  const propertyName = (membership.properties as unknown as { name: string } | null)?.name ?? '';

  // All properties this user belongs to, for the switcher -- not just the
  // one from the membership check above.
  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name)')
    .eq('user_id', user.id);

  const switcherProperties = (allMemberships ?? [])
    .map((m) => m.properties as unknown as { id: string; name: string } | null)
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, staff_onboarding_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  const showStaffOnboarding = membership.role === 'staff' && !profile?.staff_onboarding_seen_at;

  const nextObservance = await getNextObservance();

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <div className="min-h-screen bg-cream">
        <header className="flex items-center justify-between px-4 py-3 bg-cream text-charcoal border-b border-gold-light/40 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href={`/properties/${id}/dashboard`} className="flex items-center gap-2.5 shrink-0">
              <LogoMark className="w-9 h-9 shrink-0" />
              {/* Hidden below sm, same icon-only-on-mobile pattern as the
                  header's other elements (CommandPaletteTrigger, Ask the
                  House, the observance badge) -- the full wordmark was
                  running straight into the property switcher next to it on
                  narrow screens since nothing here was letting it shrink. */}
              <span className="hidden sm:inline font-display text-lg whitespace-nowrap">Sorted &amp; Stocked</span>
            </Link>
            <PropertySwitcher
              currentPropertyId={id}
              currentPropertyName={propertyName}
              properties={switcherProperties}
            />
          </div>
          <div className="flex items-center gap-3">
            {/* Compact, persistent, on every page -- hidden below sm: the
                header is already tight on mobile (logo, switcher, and
                icons), and this is a nice-to-have, not critical info. */}
            {nextObservance && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-gold-light/25 border border-gold-light/40 px-3 py-1 whitespace-nowrap">
                <span className="font-display text-sm text-charcoal">{nextObservance.name}</span>
                <span className="text-xs text-charcoal/50">
                  {nextObservance.daysUntil === 0 ? 'today' : `${nextObservance.daysUntil}d`}
                </span>
              </div>
            )}
            <AskTheHouseClient propertyId={id} />
            <CommandPaletteTrigger />
            <LocaleToggle />
            <HeaderAvatarUpload
              userId={user.id}
              fullName={profile?.full_name}
              email={user.email}
              avatarUrl={profile?.avatar_url}
            />
            <LogoutButton variant="light" />
          </div>
        </header>
        <div className="sticky top-[60px] z-20">
          <DesktopNav propertyId={id} role={membership.role as PropertyRole} />
        </div>
        <main className="pb-20 md:pb-0">
          {children}
          <Footer propertyId={id} />
        </main>
        <MobileBottomNav propertyId={id} />
        <CommandPalette propertyId={id} />
        {showStaffOnboarding && (
          <StaffOnboardingModal propertyId={id} propertyName={propertyName} userId={user.id} />
        )}
      </div>
    </PropertyRoleProvider>
  );
}
