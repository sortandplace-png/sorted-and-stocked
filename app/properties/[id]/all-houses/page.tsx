// app/properties/[id]/all-houses/page.tsx
// Cross-house inventory console (SS-399). Lives UNDER a property rather
// than at the top level like /procurement, so the existing property layout
// already handles the membership check and the module gate before this
// runs.
//
// NO NEW SURFACE, NO NEW POLICY: it reads inventory_items directly, which
// carries inventory_items_select_member USING is_property_member(property_id).
// That is the same guarantee that made v_low_stock_all_properties safe --
// RLS confines every row to houses the viewer is already a member of, so
// "all houses" can only ever mean "all of THEIR houses". Nothing widens.
//
// Reads inventory_items rather than the low-stock views on purpose: those
// views require last_counted_at IS NOT NULL and currently return 4 rows
// across 1 house, which would have made the residence-pill grouping -- the
// entire point -- unrenderable. Low stock is a filter chip on top instead.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AllHousesInventoryClient from '@/components/AllHousesInventoryClient';
import { isModuleEnabled, isOperatorConsole } from '@/lib/module-flags';
import type { HouseInventoryRow } from '@/lib/cross-house-inventory';

export const dynamic = 'force-dynamic';

export default async function AllHousesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Owner+manager, NOT owner-only: Racquel is a manager rather than the
  // residence owner (SS-389), so an owner-only gate would lock out the
  // person this console exists for. Same tier Procurement uses.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  // Operator-console only. This shipped ungated, so it appeared in the Shop
  // menu of EVERY property including Strauss Main -- a cross-house view
  // rendered inside one house, which is wrong now and would be visibly
  // wrong once each white-label client has a single house of their own.
  const hostFlags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(hostFlags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  // Every house this person owns/manages -- archived fixtures excluded, and
  // module_inventory respected, so a house that has inventory switched off
  // does not appear in a cross-house inventory view.
  const { data: memberships } = await supabase
    .from('property_members')
    .select('role, properties(id, name, archived_at, feature_flags)')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager']);

  const houses = (memberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          archived_at: string | null;
          feature_flags: Record<string, unknown> | null;
        } | null
    )
    .filter((p): p is { id: string; name: string; archived_at: string | null; feature_flags: Record<string, unknown> | null } => !!p)
    .filter((p) => !p.archived_at)
    .filter((p) => isModuleEnabled(p.feature_flags, 'module_inventory'));

  const houseNameById = new Map(houses.map((h) => [h.id, h.name]));
  const houseIds = houses.map((h) => h.id);

  const { data: items } = houseIds.length
    ? await supabase
        .from('inventory_items')
        .select(
          'id, property_id, name, name_es, category, current_qty, min_qty, auto_restock_eligible, last_counted_at, photo_url, reorder_link, reorder_sources(id, retailer_name, url, is_preferred)'
        )
        .in('property_id', houseIds)
    : { data: [] };

  const rows: HouseInventoryRow[] = (items ?? []).map((r) => {
    const row = r as unknown as Omit<HouseInventoryRow, 'property_name'>;
    return { ...row, property_name: houseNameById.get(row.property_id) ?? '' };
  });

  const categories = [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))].sort();

  return (
    <AllHousesInventoryClient
      rows={rows}
      categories={categories}
      houseCount={houses.length}
      currentPropertyId={id}
    />
  );
}
