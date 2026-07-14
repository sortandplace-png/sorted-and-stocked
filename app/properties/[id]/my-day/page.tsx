// app/properties/[id]/my-day/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MyDayClient from '@/components/MyDayClient';

export default async function MyDayPage({
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

  // Parent layout already confirmed membership on this property — no
  // additional role gate here. This is staff's landing page, but nothing
  // about it is staff-exclusive (an owner/manager visiting directly just
  // sees their own assigned tasks, which may be none).
  return <MyDayClient propertyId={id} />;
}
