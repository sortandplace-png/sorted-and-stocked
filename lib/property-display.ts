// lib/property-display.ts
// SS-359: a bare property name reads as an unrelated place when it's really
// one of several properties under the same household (e.g. "Main" and
// "Country" are both Strauss). The rule is about household SIZE, not name
// matching: a single-property household shows just the household name
// (never "Lax — Lax"); a multi-property household shows "Household —
// Property". This has to be count-based rather than "does the household
// name equal the property name" -- most future households will have one
// property whose name differs from the household's own name, and that
// case still needs to collapse to the bare household name.
export function formatPropertyLabel(
  propertyName: string,
  household?: { name: string; propertyCount: number } | null
): string {
  if (!household) return propertyName;
  if (household.propertyCount <= 1) return household.name;
  return `${household.name} — ${propertyName}`;
}

// Household size has to be counted against the WHOLE properties table, not
// just whatever subset a given query happens to return (e.g. one viewer's
// memberships) -- a household's real shape doesn't depend on who's asking.
export function buildHouseholdCounts(rows: { household_id: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.household_id) continue;
    counts.set(row.household_id, (counts.get(row.household_id) ?? 0) + 1);
  }
  return counts;
}

export type RawPropertyWithHousehold = {
  id: string;
  name: string;
  household_id: string | null;
  households: { name: string } | null;
};

// Shared by every property switcher: group by household so sibling
// properties sort adjacent (properties with no household sort last), then
// by name within a household, and resolve each to its final display label.
export function buildSwitcherProperties(
  raw: RawPropertyWithHousehold[],
  householdCounts: Map<string, number>
): { id: string; label: string }[] {
  return [...raw]
    .sort((a, b) => {
      const aHousehold = a.households?.name ?? null;
      const bHousehold = b.households?.name ?? null;
      if (aHousehold !== bHousehold) {
        if (aHousehold === null) return 1;
        if (bHousehold === null) return -1;
        return aHousehold.localeCompare(bHousehold);
      }
      return a.name.localeCompare(b.name);
    })
    .map((p) => {
      const household =
        p.household_id && p.households?.name
          ? { name: p.households.name, propertyCount: householdCounts.get(p.household_id) ?? 1 }
          : null;
      return { id: p.id, label: formatPropertyLabel(p.name, household) };
    });
}
