// app/properties/[id]/staff/clip-review/page.tsx
// SS-430: owner-only clip review queue -- same operator-owner gate the
// migration-171 policies enforce at the data layer, applied server-side
// here too (SS-381: never just a hidden tile).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOperatorConsole } from '@/lib/module-flags';
import ClipReviewClient from '@/components/ClipReviewClient';

export const metadata = {
  title: 'Clip Review — Sorted & Stocked',
};

export default async function ClipReviewPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!membership || membership.role !== 'owner') {
    redirect(`/properties/${id}/dashboard`);
  }
  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  return <ClipReviewClient />;
}
