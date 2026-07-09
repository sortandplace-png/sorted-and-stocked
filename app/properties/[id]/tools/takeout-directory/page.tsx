// app/properties/[id]/tools/takeout-directory/page.tsx
import LocalFoodDirectoryClient from '@/components/LocalFoodDirectoryClient';

export default async function TakeoutDirectoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocalFoodDirectoryClient propertyId={id} />;
}
