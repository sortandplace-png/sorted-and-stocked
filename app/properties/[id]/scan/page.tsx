// app/properties/[id]/scan/page.tsx
import ScanClient from '@/components/ScanClient';

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScanClient propertyId={id} />;
}
