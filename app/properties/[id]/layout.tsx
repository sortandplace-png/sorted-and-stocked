// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomNav from '@/components/nav/MobileBottomNav';
import LogoutButton from '@/components/LogoutButton';
import Avatar from '@/components/Avatar';
import CommandPalette from '@/components/CommandPalette';
import CommandPaletteTrigger from '@/components/CommandPaletteTrigger';
import { LogoMark } from '@/components/Logo';
import LocaleToggle from '@/components/LocaleToggle';
import { PropertyRoleProvider, type PropertyRole } from '@/components/PropertyRoleContext';

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

  const propertyName = (membership.properties as unknown as { name: string } | null)?.name;

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <div className="min-h-screen bg-cream">
        <header className="flex items-center justify-between px-4 py-3 bg-cream text-charcoal border-b border-gold-light/40 sticky top-0 z-30 print:hidden">
          <Link href={`/properties/${id}/dashboard`} className="flex items-center gap-2.5 min-w-0">
            <LogoMark className="w-9 h-9" />
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-lg">Sorted &amp; Stocked</span>
              <span className="block text-[11px] text-charcoal/60 truncate">{propertyName}</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <CommandPaletteTrigger />
            <LocaleToggle />
            <Avatar fullName={profile?.full_name} email={user.email} size="sm" />
            <LogoutButton variant="light" />
          </div>
        </header>
        <div className="sticky top-[60px] z-20">
          <DesktopNav propertyId={id} role={membership.role as PropertyRole} />
        </div>
        <main className="pb-20 md:pb-0">{children}</main>
        <MobileBottomNav propertyId={id} />
        <CommandPalette propertyId={id} />
      </div>
    </PropertyRoleProvider>
  );
}
