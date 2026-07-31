// app/properties/[id]/contacts-vendors/page.tsx
// SS-290 + SS-336, "build" ruled 31 Jul: ONE surface serving
// household_contacts and the suppliers concept, instead of a contacts
// modal buried in Tools and a separate operator-only suppliers page.
//
// Two Concept B sections under denim strips (the SS-436 console pattern):
//   CONTACTS -- the existing bilingual household_contacts CRUD, any
//     owner/manager on this property.
//   VENDORS -- the purchasing directory (inventory suppliers with their
//     item lists + reorder links). Operator-gated like the standalone
//     /tools/suppliers page (Racquel 30 Jul: who the operation buys from
//     is business-wide) -- on a non-operator property the section simply
//     doesn't render rather than blocking the contacts half.
// Both underlying clients are already bilingual (R19); nothing is
// duplicated -- this composes them, same as the console does.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HouseholdContactsClient from '@/components/HouseholdContactsClient';
import SuppliersClient, { type Supplier } from '@/components/SuppliersClient';
import { isOperatorConsole } from '@/lib/module-flags';

export const metadata = {
  title: 'Contacts & Vendors — Sorted & Stocked',
};

function SectionStrip({ label }: { label: string }) {
  return (
    <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5 rounded-t-xl3">
      {label}
    </div>
  );
}

export default async function ContactsVendorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  const showVendors = isOperatorConsole(flags);

  let suppliers: Supplier[] = [];
  if (showVendors) {
    const { data: rows } = await supabase
      .from('inventory_items')
      .select('id, name, name_es, supplier, reorder_link, reorder_sources(url, is_preferred)')
      .eq('property_id', id)
      .not('supplier', 'is', null)
      .order('supplier')
      .order('name');

    const bySupplier = new Map<string, Supplier>();
    for (const r of rows ?? []) {
      const name = r.supplier?.trim();
      if (!name) continue;
      const sources = (r.reorder_sources ?? []) as { url: string | null; is_preferred: boolean }[];
      const reorderUrl =
        sources.find((s) => s.is_preferred)?.url ?? sources[0]?.url ?? r.reorder_link ?? null;
      const entry: Supplier = bySupplier.get(name) ?? { name, items: [] };
      entry.items.push({ id: r.id, name: r.name, nameEs: r.name_es, reorderUrl });
      bySupplier.set(name, entry);
    }
    suppliers = [...bySupplier.values()].sort((a, b) => b.items.length - a.items.length);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
      <section className="rounded-xl3 border border-cardBorder shadow-card bg-card overflow-hidden">
        <SectionStrip label="Contacts · Contactos" />
        <div className="p-4 md:p-6">
          <HouseholdContactsClient propertyId={id} />
        </div>
      </section>

      {showVendors && (
        <section className="rounded-xl3 border border-cardBorder shadow-card bg-card overflow-hidden">
          <SectionStrip label="Vendors · Proveedores" />
          <div className="p-4 md:p-6">
            <SuppliersClient propertyId={id} suppliers={suppliers} />
          </div>
        </section>
      )}
    </div>
  );
}
