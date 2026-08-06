// app/properties/[id]/tools/contacts/page.tsx
// SS-025. "Contacts & Vendors" -- the TOOLS tile title this route has
// carried since before this section existed (app/properties/[id]/tools/
// page.tsx). Two tables, one page, two sections, NEVER merged: contacts
// are PEOPLE (household_contacts), vendors are PLACES (suppliers). The
// page owns the shared h1; each section owns its own h2, matching the
// pattern VendorsSection already uses.
import HouseholdContactsClient from '@/components/HouseholdContactsClient';
import VendorsSection from '@/components/VendorsSection';

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-4">Contacts &amp; Vendors</h1>
      <HouseholdContactsClient propertyId={id} />
      <VendorsSection propertyId={id} />
    </div>
  );
}
