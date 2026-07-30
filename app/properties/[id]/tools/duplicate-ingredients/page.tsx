// app/properties/[id]/tools/duplicate-ingredients/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DuplicateIngredientsClient from '@/components/DuplicateIngredientsClient';

export default async function DuplicateIngredientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Reachable and fully functional for any role by direct URL despite the
  // Tools Hub tile already being hidden from staff -- that hid the
  // discovery path, not the route itself. Merges ingredient spelling
  // variants across every recipe on the property, a real bulk mutation.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <DuplicateIngredientsClient propertyId={id} />;
}
