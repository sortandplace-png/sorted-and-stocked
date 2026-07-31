// app/properties/[id]/register/page.tsx
// SS-457: the live register viewer. Lax only, owner/manager only -- the
// exact SS-436/SS-410 operator-console gate, server-side, not a hidden
// nav tile (SS-381). Reads work_items LIVE on every load (no caching:
// auth cookies already force dynamic rendering) through the caller's own
// session, so work_items_select_operator (migration 156) is what actually
// decides access -- this page never widens read access to the register
// (and must not: that removal is a standing rule).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOperatorConsole } from '@/lib/module-flags';
import RegisterViewerClient, { type WorkItemRow } from '@/components/RegisterViewerClient';

export const metadata = {
  title: 'Register — Sorted & Stocked',
};

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }
  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  const { data: items } = await supabase
    .from('work_items')
    .select(
      'id, title, detail, status, evidence, owner, sent_to_code_at, code_reported_at, verified_at, verified_how, screenshot_ref, superseded_by, created_at, updated_at'
    );

  return <RegisterViewerClient rows={(items ?? []) as WorkItemRow[]} />;
}
