// app/properties/[id]/tools/contacts/page.tsx
import HouseholdContactsClient from '@/components/HouseholdContactsClient';

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HouseholdContactsClient propertyId={id} />;
}
