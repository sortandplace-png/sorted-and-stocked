// app/properties/[id]/tools/suppliers/page.tsx
// SS-025. Which stores this property buys from, what each supplies, and
// where to reorder it.
//
// Owner/manager only, guarded here rather than relying on RLS alone -- same
// pattern and same reasoning as tools/tasks, which documents why: a page
// listing every supplier and its item list is a purchasing view, not
// something a housekeeper needs.
//
// Property-scoped, not household-scoped. inventory_items carries
// property_id, and Main's suppliers are not necessarily Lax's -- a
// household-wide list would tell a manager standing in one house to reorder
// from a store the other house uses.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SuppliersClient, { type Supplier } from '@/components/SuppliersClient';
import { isOperatorConsole } from '@/lib/module-flags';

export default async function SuppliersPage({ params }: { params: Promise<{ id: string }> }) {
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

  // No membership row is treated as the least privileged, not the most.
  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  // Operator-level, not per-house (Racquel, 30 Jul): who the operation buys
  // from is a business-wide directory, not something each client's house
  // maintains its own copy of. Same gate as the cross-house console.
  const hostFlags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(hostFlags)) {
    redirect(`/properties/${id}/inventory`);
  }

  const { data: rows } = await supabase
    .from('inventory_items')
    .select('id, name, name_es, supplier, reorder_link, reorder_sources(url, is_preferred)')
    .eq('property_id', id)
    .not('supplier', 'is', null)
    .order('supplier')
    .order('name');

  // Grouped here rather than in the client so the page arrives ready to
  // render -- there is no interaction that would change the grouping.
  const bySupplier = new Map<string, Supplier>();
  for (const r of rows ?? []) {
    const name = r.supplier?.trim();
    if (!name) continue;

    const sources = (r.reorder_sources ?? []) as { url: string | null; is_preferred: boolean }[];
    // Preferred wins; otherwise the first source; otherwise the item's own
    // legacy reorder_link, which predates the reorder_sources table and is
    // still populated on some rows.
    const reorderUrl =
      sources.find((s) => s.is_preferred)?.url ?? sources[0]?.url ?? r.reorder_link ?? null;

    // Annotated: without it the `items: []` fallback infers never[] and the
    // push below has nothing it can accept.
    const entry: Supplier = bySupplier.get(name) ?? { name, items: [] };
    entry.items.push({
      id: r.id,
      name: r.name,
      nameEs: r.name_es,
      reorderUrl,
    });
    bySupplier.set(name, entry);
  }

  const suppliers = [...bySupplier.values()].sort((a, b) => b.items.length - a.items.length);

  return <SuppliersClient propertyId={id} suppliers={suppliers} />;
}
