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
    // stylesheet, not assumed. Every other color (sage, rust, etc., still
    // used as shadow-{color}/{opacity} in some files) keeps working exactly
    // as before -- only the two colliding keys are removed.
    boxShadowColor: ({ theme }: { theme: (path: string) => Record<string, string> }) => {
      const { card, cardHover, ...rest } = theme('colors');
      return rest;
    },
    extend: {
      colors: {
        // Kashrut/status indicator tokens -- survived the charcoal/gold/
        // cream retirement (2026-07-26) on purpose, not an oversight.
        // sage/rust/dairy are the permanent, colorblind-safe meat/dairy/
        // pareve + success/alert color system (see KASHRUT_INFO in
        // app/properties/[id]/dashboard/page.tsx) -- a different role
        // entirely from the aesthetic tokens that were removed, even
        // though they shared a config block by coincidence of era.
        sage: '#8CA085',       // success — softened, not clinical green
        rust: '#B5636B',       // alerts/low-stock — dusty rose-red, not brown-rust
        dairy: '#4A6B8A',      // dusty blue — third kashrut-indicator color, same softened treatment as rust/sage

        // SS-308. Overdue/needs-attention, as a three-part set: this badge
        // is always a fill + border + text together, which is why it is
        // three values rather than one like sage/rust/dairy above.
        //
        // Deliberately NOT folded into rust. rust means "stock is low";
        // briar means "this is overdue or wants attention". Same family of
        // red, different meanings, and collapsing them would make the two
        // indistinguishable at exactly the moment a manager needs to tell
        // them apart.
        //
        // Was copy-pasted raw across four call sites in three files, one of
        // which carried a comment instructing future edits to keep copying
        // the hex. That comment is why this token exists.
        briar: {
          bg: '#FDF2F2',
          border: '#F8C4C4',
          DEFAULT: '#9B2C2C',  // text
        },

        // Observance gating amendment (2026-07-31): allergen and dietary
        // tags get their OWN token set, drawn from the Concept B palette
        // (mist/denimBlue and linen/brass below), because the kashrut
        // three above -- rust #B5636B / dairy #4A6B8A / sage #8CA085 --
        // stay reserved for Meat/Dairy/Parve only. Same fill+border+text
        // three-part shape as briar, since these badges also always
        // render as a set.
        allergenTag: {
          bg: '#E8EEF6',      // mist
          border: '#6B8DBE',  // denimBlue
          DEFAULT: '#2E4A62', // text -- denim
        },
        dietaryTag: {
          bg: '#FFFAF3',      // linen
          border: '#C6A46E',  // brass (border only -- R9: brass never a fill outside kosher badges)
          DEFAULT: '#2E4A62', // text -- denim
        },

        // Bold Direction (2026-07-15) — RETIRED 2 Aug 2026 on Racquel's
        // "Concept B is universal" ruling. The last consumers (/welcome,
        // ThisWeeksMealsList, RequestAccessForm) moved to the Concept B
        // tokens below; the Bold kashrut variants (fleishigBold #9C2E22 /
        // milchigBold #243F63 / parveBold #3E5734) are gone for good --
        // kashrut renders ONLY as the functional rust/dairy/sage triple
        // above, unmodified. ink/ink-soft/stone/line/muted2 removed with
        // them once their consumer count hit zero.

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
