// lib/property-accent.ts
// The operator-console rose treatment (SS-459, superseding the original
// name-keyed version of this file). History: this began as "Lax's pink
// card accent", keyed on properties.name === 'Lax', with a comment
// forbidding generalisation. Racquel has since ruled the treatment is
// DELIBERATE AND PERMANENT and belongs to the operator console as a
// concept, not to a property name: it is driven off
// feature_flags->>'operator_console' (true for Lax alone today), never off
// the name, and it has named tokens -- text-console / bg-console-tint in
// tailwind.config.ts, sitting with the permanent functional set
// (sage/rust/dairy), not the aesthetic palette. Do not normalise it to
// mist in any design pass.
//
// The hex constants the old version exported were used nowhere; call
// sites carried raw hexes, which is why the tokens now exist instead.
import { isOperatorConsole } from '@/lib/module-flags';

export function isConsoleAccentProperty(flags: Record<string, unknown> | null | undefined): boolean {
  return isOperatorConsole(flags);
}
