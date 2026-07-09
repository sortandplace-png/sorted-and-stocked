// app/properties/[id]/tools/borrowed-items/page.tsx
import BorrowedItemsClient from '@/components/BorrowedItemsClient';

export default async function BorrowedItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BorrowedItemsClient propertyId={id} />;
}
