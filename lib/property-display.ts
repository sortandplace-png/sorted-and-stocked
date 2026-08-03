// lib/property-display.ts
// SS-459 (Racquel ruled, 3 Aug). Display change, not a data change:
// properties.name stays "Main"/"Country" in the database, and nothing
// find-and-replaces the literal "Main" anywhere -- it is an ordinary word,
// a git branch, a <main> element and the main nav throughout this repo.
// (Third instance of that caution: SS-541 "staff", SS-566 the app name.)
//
// LABEL RULE -- conditional, never a bare join:
//     households.name === properties.name  ->  properties.name alone
//     otherwise                            ->  households.name + " " + properties.name
// It must be conditional: three of five live properties have a household
// named identically to the property (Lax/Lax, Low/Low, Henderson/Henderson),
// so an unconditional join renders "Lax Lax". Only Country and Main gain a
// prefix -- "Strauss Country", "Strauss Main", the same labels the Task
// Center pills already show. Space-joined, no dash: an em dash here would
// also violate the standing no-dash rule for user-facing strings.
//
// This SUPERSEDES the SS-359 count-based rule that lived here (household
// with one property -> household name; several -> "Household — Property").
// The old header comment argued count-based was more future-proof; Racquel
// ruled the equality form, verified against the live data. propertyCount is
// still accepted so older call sites compile, but it decides nothing.
//
// ORDER RULE -- everywhere a property list renders:
// the operator-console property first (feature_flags->>'operator_console',
// true for Lax alone -- keyed on the FLAG, never the name), then the rest
// alphabetically by the COMPOSED label, not by properties.name. Canonical
// live result: Lax, Henderson, Low, Strauss Country, Strauss Main.
// A null-household property (QA Demo) falls back to its own name and sorts
// alphabetically with the rest -- no null-last special case. (That it
// should not be in the picker at all is SS-512, separate and still open.)
import { isOperatorConsole } from '@/lib/module-flags';

export function formatPropertyLabel(
  propertyName: string,
  household?: { name: string; propertyCount?: number } | null
): string {
  if (!household?.name) return propertyName;
  if (household.name === propertyName) return propertyName;
  return `${household.name} ${propertyName}`;
}

// Kept for compatibility -- the SS-459 label rule no longer needs counts.
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
  feature_flags?: Record<string, unknown> | null;
  households: { name: string } | null;
};

export function comparePropertyEntries(
  a: { label: string; consoleAccent: boolean },
  b: { label: string; consoleAccent: boolean }
): number {
  if (a.consoleAccent !== b.consoleAccent) return a.consoleAccent ? -1 : 1;
  return a.label.localeCompare(b.label);
}

// The ONE implementation of the SS-459 rules. Both app layouts previously
// inlined their own copy of this sort, which is exactly how two surfaces
// came to disagree about what a house is called; they now both call this.
// consoleAccent doubles as the rose-treatment signal (bg-console-tint /
// text-console) and the sort pin -- one flag, both behaviours, per ruling.
export function buildSwitcherProperties(
  raw: RawPropertyWithHousehold[]
): { id: string; label: string; consoleAccent: boolean }[] {
  return raw
    .map((p) => ({
      id: p.id,
      label: formatPropertyLabel(p.name, p.households),
      consoleAccent: isOperatorConsole(p.feature_flags),
    }))
    .sort(comparePropertyEntries);
}
