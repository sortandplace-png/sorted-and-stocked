// app/properties/[id]/tools/low-stock/page.tsx
// SS-013. Cross-property low stock -- the shared buying view.
//
// Manager+ gate only, same shape as tools/needs-linking: no membership row
// or a staff role redirects to this property's own Inventory. NOT scoped
// to operator_console like Suppliers -- this is useful to any manager
// with more than one house, not operator-only machinery.
//
// No server-side data fetch here, deliberately. get_low_stock_all_
// properties is SECURITY INVOKER over a view built on RLS-protected
// tables (migration 211), so it already scopes itself to whatever
// properties the calling user can see -- fetching server-side and passing
// props down would just be a second, redundant scoping mechanism that
// could disagree with the first. The client calls the RPC directly.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CrossPropertyLowStockClient from '@/components/CrossPropertyLowStockClient';

export default async function LowStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  // No membership row is treated as the least privileged, not the most.
  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  return <CrossPropertyLowStockClient />;
}
