# SECURITY — CREDENTIALS, ROTATION, MONITORING

SS-099 (queue-all ruled, 31 Jul 2026). Four sections: the rotation SOP, the
OpenAI-key re-check result, the secret inventory, and basic monitoring.
Update this file whenever a secret is added, moved, or rotated (R21: never
delete history — strike through and date instead).

## 1. Credential-rotation SOP

Rotate immediately if a secret appears in: a chat transcript, a screenshot,
a git commit, a log, or an ex-collaborator's possession. Otherwise rotate
service keys twice a year.

Order of operations (do NOT revoke first — the app must never be down):
1. **Mint the new credential** at the provider (Supabase / Twilio / Resend /
   Google Cloud / Anthropic / OpenAI).
2. **Update every consumer** before revoking the old one:
   - Vercel → Project → Settings → Environment Variables (Production +
     Preview), then redeploy.
   - Supabase Edge Function secrets (`supabase secrets set`) for functions
     that use it (Twilio + Resend: `send-low-stock-alert`,
     `send-borrowed-item-reminder`, `weekly-digest`,
     `send-late-clockin-alert`).
   - `vault.decrypted_secrets` row `edge_function_service_role_key` — the
     pg_cron jobs authenticate with it; if the service-role key rotates,
     update the vault row in the same sitting or all four cron jobs break.
   - Local `.env.local` files (both checkouts).
3. **Revoke the old credential** at the provider.
4. **Verify**: one authenticated app request, one cron-driven edge function
   run (check `cron.job_run_details` / function logs), one SMS or email
   send (to racq1020@gmail.com only, per the standing test rule).
5. Log the rotation: date, credential, reason, in this file's §5.

Precedent: the service-role key was rotated 9 Jul 2026 ("appjuly9",
SS-004).

## 2. OpenAI-key re-check — result (31 Jul 2026)

`OPENAI_API_KEY` appears in exactly two files, both one-off image
generation scripts (`scripts/generate-inventory-photos.mjs`,
`scripts/generate-recipe-photos.mjs`), both reading from `.env.local`.
It is **not** hardcoded anywhere, **not** used by app runtime code, **not**
in the 11 environment variables the production build reads, and has no
reason to exist in Vercel. Recommendation for Racquel: if those photo
pipelines are finished, revoke the key at platform.openai.com — nothing in
production will notice.

## 3. Secret inventory (verified against the repo, 31 Jul 2026)

| Secret | Where used | Lives in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all Supabase clients | Vercel + `.env.local` (public by design; RLS is the guard) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts`, batch API routes, `lib/recipe-actions.ts`, scripts | Vercel + `.env.local` — server-only, highest-value secret |
| `edge_function_service_role_key` | pg_cron → net.http_post auth for 4 cron jobs | Supabase Vault |
| `ANTHROPIC_API_KEY` | `lib/anthropic/client.ts` | Vercel + `.env.local` |
| `RESEND_API_KEY` | invite/consultation/billing/provision routes + 4 edge functions | Vercel + Supabase function secrets |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | `lib/sms.ts` + SMS edge functions | Vercel + Supabase function secrets |
| `OPENVERSE_CLIENT_ID` / `OPENVERSE_CLIENT_SECRET` | photo pipeline scripts, `lib/instacart-fetcher.ts` | Vercel + `.env.local` |
| `OPENAI_API_KEY` | two one-off scripts only (§2) | `.env.local` only |
| `NEXT_PUBLIC_SITE_URL` | `lib/site-url.ts` | Vercel (not secret, listed for completeness) |
| Google OAuth client secret | Supabase Auth provider config | Supabase dashboard only — never in repo/env |

Known-good properties: no secret is committed to the repo (grep-verified);
service-role usage is confined to server-only modules; the anon key is the
only key that ever reaches a browser.

## 4. Basic monitoring (what exists today; phase 2 proposals)

Exists now, check weekly:
- **Supabase advisors** (`get_advisors`, security + performance) — run after
  every DDL migration.
- **Auth logs** — sign-in failures and provider errors (24h window).
- **`sms_log`** — every SMS attempt with status + error, including failures.
- **`late_clockin_alerts`** — per-alert SMS/email statuses.
- **`cron.job_run_details`** — did the four scheduled jobs actually run.
- **Vercel deploy status** — the 27 Jul incident (13 silently failed
  builds) is why "pushed" never means "deployed"; check the deploys list
  after each session.

Phase 2 (needs a ruling, not built): Vercel log drains or Sentry for
client-side error aggregation (the SS-431 class of bug would have surfaced
in hours instead of three sessions), and an uptime ping on
app.sortandplace.com.

## 5. Rotation log

- 2026-07-09 — `SUPABASE_SERVICE_ROLE_KEY` rotated ("appjuly9", SS-004).
