// app/properties/[id]/tools/photo-worklist/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PhotoWorklistClient from '@/components/PhotoWorklistClient';

export default async function PhotoWorklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Reachable and fully functional for any role by direct URL despite the
  // Tools Hub tile already being hidden from staff -- that hid the
  // discovery path, not the route itself. Matches the tile's own intent
  // rather than loosening it: the actual per-item mutation here is mild
  // (attach a photo, clear a flag), but there's no signal anywhere else in
  // the app that staff are meant to reach this directly, unlike Kitchen
  // Timer, which is already used by every role via Recipes' floating widget.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <PhotoWorklistClient propertyId={id} />;
}
