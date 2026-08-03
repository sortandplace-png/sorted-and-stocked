// components/ui/AppHeader.tsx
// The app header, extracted from app/properties/[id]/layout.tsx.
//
// It lived inline in that layout and took propertyId + role from it, which is
// exactly why /procurement, /scan and /dashboard rendered with no chrome at
// all -- they sit outside the property segment, so there was no header to
// inherit. That was a missing layout, not a missing back link (SS-126).
//
// Only THREE of the eight elements ever needed a property: the logo link's
// href, the switcher, and search. The observance badge, locale toggle, avatar
// and logout are user-scoped and always worked without one.
//
// Cross-property pages pass no propertyId. The switcher then reads
// "All Properties" -- explicitly, never blank and never defaulted to one
// property, which would contradict what the page is showing.
//
// Search is HIDDEN when there is no property: it scopes all six of its
// queries to one, and widening it means a result-origin design as well as six
// query changes. That is SS-249, deliberately not riding inside this refactor.
import HeaderLogoLink from '@/components/HeaderLogoLink';
import HeaderSearchClient from '@/components/HeaderSearchClient';
import HeaderAvatarUpload from '@/components/HeaderAvatarUpload';
import LocaleToggle from '@/components/LocaleToggle';
import LogoutButton from '@/components/LogoutButton';
import PropertySwitcher, { type SwitcherProperty } from '@/components/PropertySwitcher';
import { LogoMark } from '@/components/Logo';

export default function AppHeader({
  propertyId,
  propertyName,
  properties,
  userId,
  userEmail,
  fullName,
  avatarUrl,
  observance,
  homeSegment = 'dashboard',
  canReachConsole = false,
}: {
  /** Absent on cross-property pages -- see the note above. */
  propertyId?: string;
  propertyName?: string;
  properties: SwitcherProperty[];
  userId: string;
  userEmail?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  observance?: { name: string; daysUntil: number } | null;
  /** Role-resolved home destination for the logo/house mark -- staff land
   *  on my-day, everyone else on dashboard (bottom-nav rebalance made
   *  this icon the sole route home). */
  homeSegment?: 'dashboard' | 'my-day';
  /** SS-567: forwarded to search so console destinations are offered only
   *  where the console is actually reachable. */
  canReachConsole?: boolean;
}) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-denim text-white sticky top-0 z-30 print:hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <HeaderLogoLink propertyId={propertyId} homeSegment={homeSegment} className="flex items-center gap-2.5 shrink-0">
          <LogoMark className="w-9 h-9 shrink-0" />
          {/* Hidden below sm: the full wordmark ran into the switcher on
              narrow screens, same icon-only-on-mobile pattern as search and
              the observance badge. */}
          <span className="hidden sm:inline font-display text-lg whitespace-nowrap">Sorted &amp; Stocked</span>
        </HeaderLogoLink>
        <PropertySwitcher
          currentPropertyId={propertyId}
          currentPropertyName={propertyName}
          properties={properties}
        />
      </div>
      <div className="flex items-center gap-3">
        {observance && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 whitespace-nowrap">
            <span className="font-display text-sm text-white">{observance.name}</span>
            <span className="text-xs text-white/60">
              {observance.daysUntil === 0 ? 'today' : `${observance.daysUntil}d`}
            </span>
          </div>
        )}
        {propertyId && <HeaderSearchClient propertyId={propertyId} canReachConsole={canReachConsole} />}
        <LocaleToggle />
        <HeaderAvatarUpload userId={userId} fullName={fullName} email={userEmail} avatarUrl={avatarUrl} propertyId={propertyId} />
        <LogoutButton variant="dark" />
      </div>
    </header>
  );
}
