// app/properties/[id]/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PropertyIconNav from '@/components/PropertyIconNav';
import LogoutButton from '@/components/LogoutButton';
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

  return (
    <PropertyRoleProvider role={membership.role as PropertyRole}>
      <div className="min-h-screen bg-cream">
        <header className="flex items-center justify-between px-4 py-3 bg-aubergine text-cream sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="Sorted & Stocked" className="w-9 h-9 object-contain shrink-0" />
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-lg">Sorted &amp; Stocked</span>
              <span className="block text-[11px] text-cream/70 truncate">{propertyName}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LocaleToggle />
            <LogoutButton />
          </div>
        </header>
        <div className="sticky top-[60px] z-20">
          <PropertyIconNav propertyId={id} role={membership.role as PropertyRole} />
        </div>
        <main>{children}</main>
      </div>
    </PropertyRoleProvider>
  );
}
