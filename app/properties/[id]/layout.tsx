// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomNav from '@/components/nav/MobileBottomNav';
import LogoutButton from '@/components/LogoutButton';
import HeaderAvatarUpload from '@/components/HeaderAvatarUpload';
import CommandPalette from '@/components/CommandPalette';
import CommandPaletteTrigger from '@/components/CommandPaletteTrigger';
import { LogoMark } from '@/components/Logo';
import LocaleToggle from '@/components/LocaleToggle';
import { PropertyRoleProvider, type PropertyRole } from '@/components/PropertyRoleContext';
import PropertySwitcher from '@/components/PropertySwitcher';
import Footer from '@/components/Footer';
import { groupYomTovOccasions, daysBetween } from '@/lib/yom-tov';

type UpcomingObservance = { name: string; date: string; daysUntil: number };

// yom_tov_dates and fast_days both have no property_id -- same shared
// calendar tables serve every property. Lives in the layout (not the
// Dashboard page) so the countdown is a persistent small header badge on
// every page, not a full-width banner that only exists on Dashboard and
// pushes its content down.
//
// Merges both sources rather than showing Yom Tov only -- a minor fast like
// Tzom Tammuz or Tish'a B'Av is very often the actually-nearest observance
// and was previously invisible here. Yom Kippur is a real row in BOTH
// tables (it's both a Yom Tov and a major fast) -- deduped by date after
// sorting so it surfaces once, not as two adjacent badges for the same day.
async function getNextObservance(): Promise<UpcomingObservance | null> {
  const supabase = await createClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [{ data: yomTovRows }, { data: fastRows }] = await Promise.all([
    supabase.from('yom_tov_dates').select('date, holiday_name').gte('date', todayStr).order('date'),
    supabase.from('fast_days').select('date, holiday_name').gte('date', todayStr).order('date'),
  ]);

  const yomTovOccasions = groupYomTovOccasions(yomTovRows || [], todayStr);
  const fastOccasions: UpcomingObservance[] = (fastRows || []).map((r) => ({
    name: r.holiday_name,
    date: r.date,
    daysUntil: daysBetween(todayStr, r.date),
  }));

  const merged = [...yomTovOccasions, ...fastOccasions].sort((a, b) => a.date.localeCompare(b.date));
  const deduped: UpcomingObservance[] = [];
  for (const occ of merged) {
    if (deduped.length > 0 && deduped[deduped.length - 1].date === occ.date) continue;
    deduped.push(occ);
  }
  return deduped[0] ?? null;
}

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
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const nextObservance = await getNextObservance();

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <div className="min-h-screen bg-cream">
        <header className="flex items-center justify-between px-4 py-3 bg-cream text-charcoal border-b border-gold-light/40 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href={`/properties/${id}/dashboard`} className="flex items-center gap-2.5 min-w-0">
              <LogoMark className="w-9 h-9" />
              <span className="font-display text-lg whitespace-nowrap">Sorted &amp; Stocked</span>
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
      </div>
    </PropertyRoleProvider>
  );
}
