// app/properties/[id]/inventory/page.tsx
import { createClient } from '@/lib/supabase/server';
import InventoryClient from '@/components/InventoryClient';
import { getPhotolessCount } from '@/lib/photo-worklist-count';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ location?: string; new?: string; item?: string; category?: string; lowStock?: string }>;
}) {
  const { id } = await params;
  const { location, new: openNew, item, category, lowStock } = await searchParams;
  // SS-869 part 3: "this shouldn't be a drop down" -- was two taps inside
  // the Staff menu. Counted server-side so the entry point can render (or
  // stay hidden at zero) without a second client round trip on load.
  const supabase = await createClient();
  const photolessCount = await getPhotolessCount(supabase, id);
  return (
    <InventoryClient
      propertyId={id}
      initialLocationFilter={location ?? null}
      initialOpenNew={openNew === '1'}
      initialItemId={item ?? null}
      initialCategoryFilter={category ?? null}
      photolessCount={photolessCount}
      // SS-853: the Shop All Houses "Low Stock by Property" cards were
      // dead tiles with no href at all -- this is the destination, same
      // Low Stock pill the page already has, just pre-applied.
      initialLowStockFilter={lowStock === '1'}
    />
  );
}
