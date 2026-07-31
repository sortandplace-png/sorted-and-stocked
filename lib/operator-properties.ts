// lib/operator-properties.ts
// The operator console's property list -- every property the signed-in
// user owns or manages, unarchived, labelled household + property
// ("Strauss Main", never bare "Main" -- Racquel has asked three times).
// Extracted because the console page, the Task Center mounts and Shop All
// Houses all need the identical list and label rules, and three inline
// copies is how labels drift.
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatPropertyLabel } from '@/lib/property-display';

export type OperatorProperty = { id: string; label: string };

export async function getOperatorProperties(
  supabase: SupabaseClient,
  userId: string
): Promise<OperatorProperty[]> {
  const { data: memberships } = await supabase
    .from('property_members')
    .select('role, properties(id, name, household_id, archived_at, households(name))')
    .eq('user_id', userId)
    .in('role', ['owner', 'manager']);

  // Household size counted against the whole table, not just this user's
  // memberships -- same reasoning as app/properties/[id]/layout.tsx.
  const { data: allHouseholdIds } = await supabase
    .from('properties')
    .select('household_id')
    .not('household_id', 'is', null);
  const householdCounts = new Map<string, number>();
  for (const row of allHouseholdIds ?? []) {
    const hid = row.household_id as string;
    householdCounts.set(hid, (householdCounts.get(hid) ?? 0) + 1);
  }

  return (memberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          archived_at: string | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is NonNullable<typeof p> => p !== null && !p.archived_at
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const household =
        p.household_id && p.households?.name
          ? { name: p.households.name, propertyCount: householdCounts.get(p.household_id) ?? 1 }
          : null;
      return { id: p.id, label: formatPropertyLabel(p.name, household) };
    });
}
