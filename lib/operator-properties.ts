// lib/operator-properties.ts
// The operator console's property list -- every property the signed-in
// user owns or manages, unarchived, labelled household + property
// ("Strauss Main", never bare "Main" -- Racquel has asked three times).
// Extracted because the console page, the Task Center mounts and Shop All
// Houses all need the identical list and label rules, and three inline
// copies is how labels drift.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSwitcherProperties } from '@/lib/property-display';

export type OperatorProperty = { id: string; label: string };

export async function getOperatorProperties(
  supabase: SupabaseClient,
  userId: string
): Promise<OperatorProperty[]> {
  const { data: memberships } = await supabase
    .from('property_members')
    .select('role, properties(id, name, household_id, archived_at, feature_flags, households(name))')
    .eq('user_id', userId)
    .in('role', ['owner', 'manager']);

  // SS-459: label + order from the one shared implementation (conditional
  // household prefix, console property pinned first, then alphabetical by
  // the COMPOSED label -- the old sort here used bare properties.name,
  // which put "Main" under M when its label says "Strauss Main"). The
  // whole-table household count this used to fetch served the retired
  // SS-359 size rule and is gone with it.
  return buildSwitcherProperties(
    (memberships ?? [])
      .map(
        (m) =>
          m.properties as unknown as {
            id: string;
            name: string;
            household_id: string | null;
            archived_at: string | null;
            feature_flags: Record<string, unknown> | null;
            households: { name: string } | null;
          } | null
      )
      .filter((p): p is NonNullable<typeof p> => p !== null && !p.archived_at)
  );
}
