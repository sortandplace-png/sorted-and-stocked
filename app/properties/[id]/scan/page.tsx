// app/properties/[id]/scan/page.tsx
import ScanClient from '@/components/ScanClient';

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;
  return <ScanClient propertyId={id} initialCode={code} />;
}
