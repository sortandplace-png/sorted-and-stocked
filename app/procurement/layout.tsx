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
import { getNextObservance } from '@/lib/get-next-observance';

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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
          propertyId. The switcher is the way back into a property from here. */}
      <main className="pb-20 md:pb-0">{children}</main>
    </div>
  );
}
