// app/properties/[id]/tools/taste-memory/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GuestTasteMemoryClient from '@/components/GuestTasteMemoryClient';

export default async function TasteMemoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('feature_flags')
    .eq('id', id)
    .single();

  const flags = (property?.feature_flags ?? {}) as Record<string, boolean>;
  if (!flags.guest_taste_memory) {
    redirect(`/properties/${id}/tools`);
  }

  return <GuestTasteMemoryClient propertyId={id} />;
}
