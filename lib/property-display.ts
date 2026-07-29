// lib/property-display.ts
// SS-359: a bare property name reads as an unrelated place when it's really
// one of several properties under the same household (e.g. "Main" and
// "Country" are both Strauss). Prefixing with the household name makes that
// relationship visible. Skipped when there's no household, or when the
// household is a single-property household sharing the property's own name
// (e.g. household "Lax" owning property "Lax") -- prefixing there would
// just repeat the same word twice.
export function formatPropertyLabel(propertyName: string, householdName?: string | null): string {
  if (!householdName || householdName === propertyName) return propertyName;
  return `${householdName} — ${propertyName}`;
}
