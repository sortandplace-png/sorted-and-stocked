// app/properties/[id]/shopping-rules/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ShoppingRulesClient from '@/components/ShoppingRulesClient';

export default async function ShoppingRulesPage({
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

  // Same owner/manager-only gate as Staff -- this is a property-level
  // setting, not something staff should be changing.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <ShoppingRulesClient propertyId={id} />;
}
