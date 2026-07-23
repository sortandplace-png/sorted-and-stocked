// app/properties/[id]/tools/translation-worklist/page.tsx
import TranslationWorklistClient from '@/components/TranslationWorklistClient';

export default async function TranslationWorklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TranslationWorklistClient propertyId={id} />;
}
