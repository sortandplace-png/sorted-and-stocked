// app/properties/[id]/shopping-list/page.tsx
import ShoppingListClient from '@/components/ShoppingListClient';

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShoppingListClient propertyId={id} />;
}
