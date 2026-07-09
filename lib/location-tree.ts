// lib/location-tree.ts
// Shared helpers for locations.parent_location_id — one real tree (Basement /
// Main Floor / Upstairs, each with real sub-locations), used everywhere a
// location gets picked, filtered, or displayed.

export type LocationNode = {
  id: string;
  name: string;
  parent_location_id: string | null;
};

export type IndentedLocation = LocationNode & { depth: number };

// Depth-first flattening, root nodes first, each parent immediately
// followed by its children — the shape a <select> needs to show real
// indentation via a plain flat list.
export function flattenLocationTree(locations: LocationNode[]): IndentedLocation[] {
  const byParent = new Map<string | null, LocationNode[]>();
  for (const loc of locations) {
    const key = loc.parent_location_id;
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(loc);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: IndentedLocation[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const loc of byParent.get(parentId) ?? []) {
      result.push({ ...loc, depth });
      walk(loc.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

// "Basement › Wine Fridge" — full ancestry path for a given location id.
export function locationPath(locations: LocationNode[], id: string | null): string {
  if (!id) return 'Unassigned';
  const byId = new Map(locations.map((l) => [l.id, l]));
  const parts: string[] = [];
  let current = byId.get(id);
  let guard = 0; // defends against a corrupt/cyclic parent chain
  while (current && guard < 20) {
    parts.unshift(current.name);
    current = current.parent_location_id ? byId.get(current.parent_location_id) : undefined;
    guard++;
  }
  return parts.length > 0 ? parts.join(' › ') : 'Unassigned';
}

// The top-level ancestor's name for a given location — e.g. "Wine Fridge"
// belongs to root group "Basement". Used to group leaf locations under
// their real top-level room instead of a flat list.
export function rootGroupName(locations: LocationNode[], id: string | null): string {
  if (!id) return 'Unassigned';
  const byId = new Map(locations.map((l) => [l.id, l]));
  let current = byId.get(id);
  let guard = 0;
  while (current?.parent_location_id && guard < 20) {
    current = byId.get(current.parent_location_id);
    guard++;
  }
  return current?.name ?? 'Unassigned';
}
