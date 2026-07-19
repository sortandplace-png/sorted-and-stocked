// app/properties/[id]/inventory/page.tsx
import InventoryClient from '@/components/InventoryClient';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ location?: string; new?: string; item?: string }>;
}) {
  const { id } = await params;
  const { location, new: openNew, item } = await searchParams;
  return (
    <InventoryClient
      propertyId={id}
      initialLocationFilter={location ?? null}
      initialOpenNew={openNew === '1'}
      initialItemId={item ?? null}
    />
  );
}
