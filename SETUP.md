# Getting This Running

Follow in order. Each step depends on the one before it.

## 1. Create the Supabase project
1. supabase.com → New project. Note the project URL and anon key
   (Project Settings → API).

## 2. Run the migrations
In the Supabase SQL Editor, run these **in order** — each depends on
tables/functions from the ones before it:

1. `001_init_schema.sql`
2. `002_location_qr_codes.sql`
3. `003_auto_owner_membership.sql`
4. `004_invite_by_email.sql`
5. `005_seed_categories.sql`
6. `006_prevent_last_owner_removal.sql`
7. `007_rate_limits.sql`

Paste each file's contents into a new SQL Editor query and run it before
moving to the next one. If one fails partway through, fix the error and
re-run that same file — don't skip ahead.

## 3. Configure Auth
Supabase dashboard → Authentication → URL Configuration:
- **Site URL**: your deployed domain (or `http://localhost:3000` for local dev)
- **Redirect URLs**: add `{your-domain}/auth/callback` (and the localhost
  equivalent if developing locally) — email confirmation and password reset
  both fail silently without this.

Authentication → Providers → Email: decide whether "Confirm email" is on.
- **On**: sign-up shows a "check your email" screen before they can log in.
- **Off**: sign-up logs the user in immediately. The login page already
  handles either case — nothing to change in code, just know which one
  you're running.

## 4. Get the service role key
Project Settings → API → `service_role` key (**not** the anon key). This
powers the email-invite-to-signup flow only. Treat it like a password —
it bypasses every RLS policy in the schema.

## 5. Set environment variables
Create `.env.local` in your project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
```
As of 2026 Supabase's dashboard labels these the **publishable key** (`sb_publishable_...`) and **secret key** (`sb_secret_...`) instead of `anon`/`service_role` — same values, same variable names above, just newer naming in the dashboard UI.

**Ignore any dashboard prompt to install `@supabase/server` or set `SUPABASE_JWKS_URL`.** That's a separate package for Edge Functions/Workers, not for this Next.js app — this project uses `@supabase/ssr` instead, which is already built into `lib/supabase/server.ts` and `middleware.ts`.

Double check `SUPABASE_SERVICE_ROLE_KEY` has **no** `NEXT_PUBLIC_` prefix.

## 6. Install dependencies
```
npm install next-pwa html5-qrcode jspdf qrcode idb-keyval @supabase/ssr @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
```

## 7. Place the files
Match the folder structure from the delivered files exactly — this project
uses Next.js App Router, so file location determines routing:
- `app/` → routes and layouts
- `components/` → everything else
- `lib/` → Supabase clients, offline queue, resilient-write
- `public/` → manifest.json, icons
- `middleware.ts`, `tailwind.config.ts`, `postcss.config.js`, `next.config.js`
  → project root, next to `package.json`

## 8. First run
```
npm run dev
```
Visit `localhost:3000` → should redirect to `/login` (no session yet).

**Smoke test in this order:**
1. Sign up → creates account (check `profiles` table got a row via the trigger)
2. Create a property → check `property_members` got an `owner` row automatically
   (this confirms migration 003 worked)
3. Add a storage location, then an inventory item
4. Generate a print-labels PDF for that location
5. Manually set an item's `current_qty` below its `min_qty` in the Supabase
   table editor → check `shopping_list_items` got a row automatically
   (confirms the low-stock trigger from 001 worked)
6. Visit the shopping list page, check it off
7. Invite a second email address (one without an account) → check the
   invite email arrives and the new row appears in `property_members`

If all seven pass, the backend is fully wired.

## 9. Deploy
Vercel is the path of least resistance for Next.js. Add the same three env
vars in the Vercel project settings, then update the Supabase redirect URL
allow-list to include the production domain (step 3 again, for real this time).

---

## Known rough edges going in (see BUILD_STATUS.md for full detail)
- App icons are placeholder graphics — swap `public/icons/*.png` before a real launch
- No rate limiting on the invite API route
- Password reset and email confirmation both depend on step 3 being done correctly — this is the #1 thing people get wrong on first deploy
