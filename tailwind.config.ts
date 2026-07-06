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
        // Feminine luxury direction: deep plum + rose-gold + ivory/blush,
        // in place of the more utilitarian aubergine/gold pairing.
        aubergine: {
          DEFAULT: '#6B3550', // deep plum
          dark: '#4A2338',
        },
        gold: {
          DEFAULT: '#C08D74', // rose-gold
          light: '#F0D9CE',   // soft blush
        },
        cream: '#FBF4EF',      // ivory
        ink: '#3A2A33',        // warm plum-black
        sage: '#8CA085',       // success — softened, not clinical green
        rust: '#B5636B',       // alerts/low-stock — dusty rose-red, not brown-rust
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
