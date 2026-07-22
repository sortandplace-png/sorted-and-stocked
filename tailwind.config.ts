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
    // Overrides (not extends) Tailwind's default shadow-color palette --
    // otherwise it mirrors theme.colors verbatim, and this project's own
    // custom boxShadow preset keys ("card", "cardHover") collide with the
    // auto-generated shadow-COLOR utilities for the same-named color
    // tokens: both compile to the literal class `.shadow-card`. CSS
    // cascade order let the auto-generated color rule win, silently
    // overriding every shadow-card usage's --tw-shadow-color to #FFFEFC
    // (the card background color -- effectively invisible) instead of the
    // intended rgba(90,120,150,.09) tint. Confirmed live via the compiled
    // stylesheet, not assumed. Every other color (charcoal, gold, etc.,
    // still used as shadow-{color}/{opacity} in un-migrated files) keeps
    // working exactly as before -- only the two colliding keys are removed.
    boxShadowColor: ({ theme }: { theme: (path: string) => Record<string, string> }) => {
      const { card, cardHover, ...rest } = theme('colors');
      return rest;
    },
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

        // Bold Direction (2026-07-15) — additive only, does NOT replace the
        // tokens above. Phase 1 of the approved redesign, Home dashboard
        // only this round; every other page still reads charcoal/gold/rust/
        // dairy/sage until/unless a later round migrates it. Once the whole
        // app has moved over, these are the real candidates to become the
        // new charcoal/rust/dairy/sage — not done yet, don't rename early.
        ink: '#171512',
        'ink-soft': '#3A362F',
        stone: '#F1ECE2',
        line: '#DED5C4',
        muted2: '#8C8373', // named distinctly from the existing `gold` family; unrelated token, same neutral-label role as charcoal/60 elsewhere
        fleishigBold: '#9C2E22',
        milchigBold: '#243F63',
        parveBold: '#3E5734',

        // New direction (2026-07-15) -- replaces Bold Direction above as of
        // the Home dashboard's full repaint this round. Bold Direction's own
        // tokens are left in the config (still referenced by other pages'
        // Bold-Direction-era styling that hasn't moved over yet) but are no
        // longer used on Home.
        // "Stone (secondary text)" from the spec is named `dusk` here, not
        // `stone` -- that name is already taken by Bold Direction's card-fill
        // token above (#F1ECE2, a different color/role entirely) and reusing
        // it would have silently overwritten one of the two.
        linen: '#FFFAF3',
        card: '#FFFEFC',
        cardBorder: '#E8DDD0',
        denimBlue: '#6B8DBE', // primary -- not named bare `blue`, which would shadow Tailwind's own blue-* shade scale
        denim: '#2E4A62',     // headings/ink
        mist: '#E8EEF6',      // fills
        brass: '#C6A46E',     // accent
        dusk: '#7A8A9C',      // secondary text
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
        // Inter is already loaded app-wide (app/layout.tsx, --font-inter)
        // but was dormant -- nothing referenced it. The new direction's
        // spec calls for Inter specifically as the body/UI face; mapped to
        // its own token rather than repointing `sans`/--font-body (Nunito
        // Sans), which would silently change body text on every other page.
        interDisplay: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',  // 20px -- small/action cards (new direction's spec)
        xl3: '1.75rem',  // 28px -- large cards (new direction's spec)
      },
      boxShadow: {
        card: '0 16px 40px rgba(90,120,150,.09)',
        cardHover: '0 20px 48px rgba(90,120,150,.15)',
      },
    },
  },
  plugins: [],
};

export default config;
