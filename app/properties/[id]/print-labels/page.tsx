// app/properties/[id]/print-labels/page.tsx
// Server component: its only job is unwrapping the async `params` object
// (required since Next.js 15 — route params are now a Promise) and handing
// a plain string down to the client component that does the real work.
import PrintLabelsClient from '@/components/PrintLabelsClient';

export default async function PrintLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrintLabelsClient propertyId={id} />;
}
