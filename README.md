# Sorted & Stocked

Household management app for kosher homes, built by Sort + Place.

Features: inventory tracking, meal planning, shopping lists, staff management, 
Jewish calendar integration, bilingual EN/ES.

**Stack:** Next.js 15, Supabase, TypeScript, Tailwind CSS, Vercel

**Live:** https://sortandplace.com

Built for the Strauss residence, Lakewood NJ.

## Running the dev server

| Who | Command | Port | Build dir |
| --- | --- | --- | --- |
| Humans | `npm run dev` | 3000 | `.next` |
| Agents / second session | `npm run dev:agent` | 3100 | `.next-agent` |

Both can run **at the same time**. They deliberately use separate build
directories: two Next dev servers sharing one `.next` on Windows produce
`EBUSY: resource busy or locked` errors on
`.next/server/app/page_client-reference-manifest.js` and take each other
down. `npm run build` is unaffected and still uses `.next`.
© Sort + Place — sortandplace@gmail.com
