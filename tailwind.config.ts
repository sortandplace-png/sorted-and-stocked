// tailwind.config.ts
// Tailwind v3 config — if your project is on Tailwind v4, this file isn't
// used the same way; instead add `@import "tailwindcss";` to the top of
// globals.css and register `@tailwindcss/postcss` in postcss.config.js.
// Check `npx tailwindcss --version` if unsure which you're on.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // True ivory/charcoal/gold direction — the earlier deep-plum +
        // rose-gold pairing (aubergine/ink) is retired; every component that
        // referenced it now points at charcoal or gold instead.
        gold: {
          DEFAULT: '#C5A46D', // true gold, not rose-gold — decorative use only (borders, fills behind dark text, icon accents): ~2.2:1 contrast on white, fails WCAG AA for text
          light: '#EBDFCC',   // pale gold tint, for borders/dividers
          dark: '#8A6E42',    // same gold family, darkened for text/interactive use — 4.79:1 on white, passes WCAG AA for normal text
          active: '#B08952',  // nav active-state indicator only — 3.21:1 on white, passes the 3:1 UI-component/large-text threshold but NOT 4.5:1 normal text, so pair with charcoal text, never use as text color itself
        },
        cream: '#FAF7F2',      // true ivory
        charcoal: '#2B2B2B',   // neutral near-black — replaces aubergine (accent) and ink (body text)
        sage: '#8CA085',       // success — softened, not clinical green
        rust: '#B5636B',       // alerts/low-stock — dusty rose-red, not brown-rust
        dairy: '#4A6B8A',      // dusty blue — third kashrut-indicator color, same softened treatment as rust/sage
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
