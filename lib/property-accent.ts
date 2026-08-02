// lib/property-accent.ts
// Lax's pink card accent -- the owner's personal brand on her own home's
// card, ruled as an INTENTIONAL one-card exception to Concept B. Scoped
// on purpose: this is a single named property's treatment, not the seed
// of a theme system -- do not generalize it, add config for it, or apply
// it to anything but the Lax card in the picker and property switcher.
// Nothing inside the Lax property itself changes.
export const PINK_ACCENT_TEXT = '#D6336C'; // hot-pink label text
export const PINK_ACCENT_TINT = '#F7E3ED'; // card tint, replaces the mist fill

export function isPinkAccentProperty(name: string | null | undefined): boolean {
  return name === 'Lax';
}
