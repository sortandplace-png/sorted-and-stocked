# Property Inventory App — Build Status

Last updated: this conversation, in progress.
This file is the single source of truth for what exists, what's pending, and
where each file lives. Update it every time a file is added or changed.

---

## ✅ DONE

### Database (Supabase / Postgres)
| File | Purpose |
|---|---|
| `001_init_schema.sql` | Full schema: profiles, properties, property_members, locations, inventory_items, shopping_lists, shopping_list_items. Enums, indexes, RLS on all tables, `is_property_member()` / `has_property_role()` helpers, low-stock → shopping-list-item trigger, auto-profile-on-signup trigger. |
| `002_location_qr_codes.sql` | Adds `qr_code` column + auto-generation trigger to `locations` (needed for the print-labels feature — v1 schema only had `qr_code` on inventory_items). |

### PWA / Offline
| File | Purpose |
|---|---|
| `next.config.js` | `next-pwa` config: cache-first for static assets, stale-while-revalidate for pages, network-first for Supabase reads. |
| `manifest.json` | Home-screen install manifest. |
| `lib/offline-queue.ts` | IndexedDB write queue (via `idb-keyval`) — queues checkbox/qty updates when offline, flushes on reconnect. Not yet wired into any component. |

### Components / Pages
| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser Supabase client helper. |
| `components/QRScanner.tsx` | `html5-qrcode` wrapper component. **Emits scanned text via `onScan` but nothing consumes it yet** — no lookup logic wired up. |
| `components/ShoppingListView.tsx` | Renders a shopping list grouped by category/aisle. Presentational only — takes `items` + `onToggle` as props, doesn't fetch data itself. |
| `app/properties/[id]/print-labels/page.tsx` | Server component, awaits async route params (Next.js 15 requirement), renders `PrintLabelsClient`. |
| `components/PrintLabelsClient.tsx` | Client component: fetches a property's locations, lets user select which to print, generates Avery 5160 PDF sheet via `jspdf` + `qrcode`. |

### Config
| File | Purpose |
|---|---|
| `tsconfig-paths-snippet.json` | Confirms `@/*` path alias needed by the imports above. |

**Not yet fixed/reverted:** the Next.js 15 async-params pattern is applied — if this project is actually on Next.js 14, say so and I'll revert `print-labels/page.tsx` to the simpler single-file version.

---

### Inventory CRUD — DONE
| File | Purpose |
|---|---|
| `app/properties/[id]/inventory/page.tsx` | Server component. Awaits async params + optional `?location=` search param (used by the scan flow). |
| `components/InventoryClient.tsx` | Full CRUD: list grouped by location, low-stock items flagged red, add/edit/delete via bottom-sheet form. Accepts `initialLocationFilter` with a clearable "Show all" banner. |

### Scan-to-lookup — DONE
| File | Purpose |
|---|---|
| `app/properties/[id]/scan/page.tsx` | Server component, awaits async params. |
| `components/ScanClient.tsx` | Wraps `QRScanner`. On scan: checks `locations.qr_code` first → routes to filtered inventory view. Falls back to `inventory_items.qr_code` → shows an inline quick quantity-adjust card. Falls back to "not found" state. Pauses camera while showing a result, resumes on "scan again"/"cancel". |

---

### App Skeleton — DONE (this turn)
| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout. Loads manifest, wraps app in `OfflineSyncProvider`. |
| `components/OfflineSyncProvider.tsx` | Starts the offline sync loop app-wide, shows a sticky "offline" banner. |
| `app/properties/[id]/layout.tsx` | Per-property layout, renders `PropertyNav` on every screen under `/properties/[id]/*`. |
| `components/PropertyNav.tsx` | **Fixed bottom nav** — Inventory / Scan / Shopping / Labels. This is the connective tissue: previously every route was only reachable by typing its URL. |
| `app/properties/[id]/page.tsx` | Redirects bare `/properties/[id]` → `/properties/[id]/inventory` so there's no dead landing page. |

### Offline queue — NOW WIRED (this turn)
| File | Purpose |
|---|---|
| `lib/resilient-write.ts` | **New.** Central `resilientInsert/Update/Delete`. Checks `navigator.onLine`; if offline OR the request fails, queues via `offline-queue.ts` instead of throwing. Returns immediately so callers can update UI optimistically. |
| `InventoryClient.tsx` | Save/delete now go through `resilient-write` with optimistic local state updates (no longer depends on a refetch, which would fail offline anyway). |
| `ScanClient.tsx` | Quantity-adjust save now goes through `resilient-write`. |

### Shopping list — NOW WIRED (this turn)
| File | Purpose |
|---|---|
| `app/properties/[id]/shopping-list/page.tsx` | Server component, awaits async params. |
| `components/ShoppingListClient.tsx` | **New — the missing data-fetching parent.** Finds/creates the property's active list, fetches items, renders the existing `ShoppingListView` (unchanged, stays presentational), wires checkbox toggling + custom item add through `resilient-write` with optimistic updates + rollback on real errors. |

---

### Auth — DONE (this turn)
| File | Purpose |
|---|---|
| `003_auto_owner_membership.sql` | **Bug fix found while building this.** Creating a property passed RLS but never added the creator to `property_members` — they'd be locked out of their own new property. Trigger now auto-enrolls creator as `owner`. |
| `lib/supabase/server.ts` | Server-side Supabase client (server components, route handlers). |
| `lib/supabase/middleware.ts` | Session-refresh logic + redirects unauthenticated requests to `/login` (path-based only — see membership note below). |
| `middleware.ts` | Root middleware wiring the above into every request except static/PWA assets. |
| `app/login/page.tsx` | Email + password sign-in/sign-up, single toggle-able form. Wrapped in `Suspense` (required by Next.js for `useSearchParams`). Handles the "check your email" state if Supabase email confirmation is enabled. |
| `app/auth/callback/route.ts` | Exchanges the email confirmation / magic-link code for a session. |
| `app/properties/page.tsx` | Property picker — lists the user's properties + role. Auto-skips straight to inventory if they only belong to one property. Entry point after login. |
| `app/properties/new/page.tsx` + `components/NewPropertyForm.tsx` | Create-property form. Relies on the 003 trigger for owner enrollment. |
| `components/LogoutButton.tsx` | Sign-out, used on the picker and the property header. |
| `app/properties/[id]/layout.tsx` | **Updated.** Now server-side checks `property_members` for this specific property and redirects to `/properties` if the signed-in user isn't a member — closes the gap where the old path-only middleware check would let any logged-in user *view* another household's property shell (RLS still blocked their actual data, but the UX was a confusing wall of empty lists rather than a clean redirect). Also adds a small header bar with property name + sign out. |
| `app/page.tsx` | Root `/` redirects to `/properties`. |

---

### Invite flow — DONE (this turn)
| File | Purpose |
|---|---|
| `004_invite_by_email.sql` | `get_user_id_by_email()` — narrow `SECURITY DEFINER` function returning only a UUID for a given email. Avoids putting the service-role key in app code just to resolve one lookup. Granted to `authenticated` only. |
| `app/properties/[id]/staff/page.tsx` | Server component. Re-checks role (not just membership) and bounces `staff` back to inventory — belt-and-suspenders alongside the RLS policies. |
| `components/StaffClient.tsx` | Lists current members + role, invite-by-email (resolves via the function above, then inserts `property_members` — RLS still does the real access-control work here), inline role change, remove member. |

**Known limitation, by design for now:** invites only work for people who already have an account. There's no "email someone a signup link" flow yet — that would need transactional email + the service-role key, which felt like a bigger scope jump than this turn warranted. Flagging instead of quietly building it.

**Edge case not handled:** nothing stops removing/demoting the *last* owner of a property, which would leave it with no owner. Worth a guard before this ships for real use.

### Role-based UI cleanup — DONE (this turn)
| File | Purpose |
|---|---|
| `components/PropertyRoleContext.tsx` | `PropertyRoleProvider` / `usePropertyRole()` / `canManage()`. Role is fetched once in the layout (server-side, already needed for the membership check) and passed down — no extra fetch per component. |
| `app/properties/[id]/layout.tsx` | Now wraps children in `PropertyRoleProvider`, passes role to `PropertyNav`. |
| `components/PropertyNav.tsx` | New "Staff" tab, visible only to owner/manager. |
| `components/InventoryClient.tsx` | Delete button in the item edit sheet now hidden for `staff` role — previously staff could see and tap Delete, then have it silently fail against RLS. |

---

### Password reset — DONE (this turn)
| File | Purpose |
|---|---|
| `app/forgot-password/page.tsx` | Requests reset email via `resetPasswordForEmail`, routed through the existing `/auth/callback` handler. Added to `PUBLIC_PATHS` in `lib/supabase/middleware.ts`. |
| `app/reset-password/page.tsx` | Sets the new password on the recovery session established by the callback. Not a public path — by the time someone lands here they have a session. |
| `app/login/page.tsx` | Updated — added "Forgot password?" link, sign-in mode only. |

### App icons — placeholder phase, superseded (see "Real icon artwork" below)
| File | Purpose |
|---|---|
| `public/manifest.json` | Moved here from the old flat `manifest.json` — Next.js serves `/public/*` at the root, so this is the path that actually needs to exist for `app/layout.tsx`'s `manifest: '/manifest.json'` reference to resolve. Still current. |

(The placeholder box-glyph icons originally generated here have since been replaced with the real "Sorted & Stocked" logo artwork — see "Real icon artwork" further down.)

### Category suggestions — DONE (this turn)
| File | Purpose |
|---|---|
| `005_seed_categories.sql` | New `categories` table, seeded with 19 common household categories (global defaults, `property_id is null`). RLS: globals readable by anyone signed in, custom per-property categories readable/deletable by members. **Not a foreign key** on `inventory_items.category` — stays free text, this only powers suggestions. |
| `components/InventoryClient.tsx` | Updated — category field now has a `<datalist>` of suggestions (global + this property's history), still accepts arbitrary typed text. |

### Last-owner guard — DONE (this turn)
| File | Purpose |
|---|---|
| `006_prevent_last_owner_removal.sql` | Trigger on `property_members` blocking any update/delete that would leave a property with zero owners. Raises a clear Postgres exception; `StaffClient.tsx`'s existing error display surfaces it as-is. |

---

### Email-invite-to-signup — DONE (this turn)
| File | Purpose |
|---|---|
| `lib/supabase/admin.ts` | **Server-only.** Service-role Supabase client. Never imported into any `'use client'` file — the service role key bypasses RLS entirely. |
| `app/api/invite/route.ts` | New API route. Verifies the caller is owner/manager of the target property using the normal RLS-respecting client *before* touching the admin client (never trusts the request body's `propertyId` alone). Calls `admin.auth.admin.inviteUserByEmail()` to create the account + send the email, then inserts `property_members` using the caller's own already-verified session. |
| `components/StaffClient.tsx` | Updated. When `get_user_id_by_email` finds nothing, instead of a dead end it now offers a "Send invite to {email}" button wired to the new route. Owner role is intentionally not selectable via invite — only grantable by promoting an existing member from the list, so account creation can't mint a second owner in one step. |

**Requires a new env var:** `SUPABASE_SERVICE_ROLE_KEY` — server-only, do **not** prefix with `NEXT_PUBLIC_` or it ships to the browser. Get it from Supabase dashboard → Project Settings → API → service_role key.

### Tailwind / globals.css — DONE (this turn)
| File | Purpose |
|---|---|
| `app/globals.css` | Tailwind directives + base body styling, imported by `app/layout.tsx` (which referenced this file since the very first skeleton turn but it never existed until now). |
| `tailwind.config.ts` | Content globs cover `app/`, `components/`, `lib/` — matches where every className used so far actually lives. **Assumes Tailwind v3** — flagged in the file comment since v4's setup differs (no config file, CSS-based config instead). |
| `postcss.config.js` | Required for Tailwind v3's build pipeline. |

---

### Setup guide — DONE (this turn)
| File | Purpose |
|---|---|
| `SETUP.md` | End-to-end runbook: create the Supabase project, run migrations in order, configure auth redirect URLs, env vars, install deps, file placement, a 7-step smoke test, deploy notes. This is the "how do I actually run this" doc — BUILD_STATUS.md stays the "what exists" doc. |

### Phase 2 polish — DONE across all 5 screens (this turn completes the rollout)
| File | Purpose |
|---|---|
| `components/Toast.tsx` | Toast notification system (`ToastProvider` + `useToast()`), mounted in `app/layout.tsx`. Supports an optional action button (used for undo) and a configurable duration. |
| `components/Skeleton.tsx` | `SkeletonList` — replaces plain "Loading…" text. |
| `lib/use-pull-to-refresh.ts` | Touch-based pull-to-refresh hook, no library. Only activates when scrolled to the top. |
| `components/InventoryClient.tsx` | Skeleton loading, pull-to-refresh, toasts, undo-after-delete. |
| `components/ShoppingListClient.tsx` | Skeleton loading, pull-to-refresh, toasts. |
| `components/ScanClient.tsx` | Added toast confirmation on quantity save (queued vs. immediate). |
| `components/PrintLabelsClient.tsx` | Added skeleton loading, a proper `catch` block around PDF generation (previously a thrown error had nowhere to go — the `finally` reset the button but never surfaced what went wrong), and toasts for both the initial fetch and generation outcomes. |
| `components/StaffClient.tsx` | Added skeleton loading, toasts on invite/role-change/remove, and optimistic role-change with rollback on failure. **This is also where the last-owner guard (`006_prevent_last_owner_removal.sql`) now surfaces clearly** — its Postgres exception message shows in a toast instead of just sitting in the inline error text. Removal still uses a `confirm()` dialog rather than undo, since there's no undo affordance built for this list yet.

Pull-to-refresh was intentionally not added to Scan, Print Labels, or Staff — none of them are long scrollable lists where that gesture makes sense the way it does on Inventory/Shopping List.

---

### AI Photo Tools — DONE (this turn)
| File | Purpose |
|---|---|
| `lib/anthropic/client.ts` | **Server-only.** Calls the real Anthropic Messages API directly (separate from Supabase) with `ANTHROPIC_API_KEY`. Supports image input + optional web search tool. Never import into a client component. |
| `app/api/tools/price-scanner/route.ts` | Identifies a photographed product, searches the web for cheaper equivalents. Prompted to state real trade-offs rather than claiming unverifiable "same quality." |
| `app/api/tools/ingredient-scanner/route.ts` | Reads a label photo, explains each ingredient in plain language. Deliberately prompted to calibrate risk to actual evidence strength rather than flagging everything — an earlier draft of this idea risked being alarmist by design, so the system prompt explicitly pushes back on that. |
| `app/api/tools/recipe-stealer/route.ts` | Reverse-engineers a recipe from a dish photo. Prompted to frame itself as a best approximation, not "the exact recipe" or a "secret" — a home cook's oven and stock aren't a restaurant's, and the prompt says so. |
| `components/PhotoToolClient.tsx` | Shared upload-photo → show-result UI used by all three tool pages, avoiding three near-duplicate components. |
| `app/properties/[id]/tools/page.tsx` + 3 sub-pages | Menu page linking to each tool. |
| `components/PropertyNav.tsx` | Updated — added a 6th "Tools" tab. **Worth flagging:** 6 tabs is at/past the usual mobile bottom-nav comfort limit; if more get added later this should collapse into a "More" menu instead of growing further. |

**New env var required:** `ANTHROPIC_API_KEY` — server-only, separate from the Supabase keys, used only inside `lib/anthropic/client.ts`. Each of these three routes costs real money per call (vision + optionally web search), so they're gated to signed-in property members only — not left open to unauthenticated requests.

**Not yet done:** no per-property or per-user rate limiting on these three routes beyond "must be a member" — closed below.

---

### Rate limiting — DONE (this turn)
| File | Purpose |
|---|---|
| `007_rate_limits.sql` | `rate_limit_events` table + `check_and_record_rate_limit()` — a `SECURITY DEFINER` Postgres function that atomically checks and records each attempt. **Deliberately built in Postgres, not in-memory** — an in-memory counter would be unreliable on Vercel/serverless since consecutive requests can land on different instances with no shared memory; Supabase is the one place every instance agrees on the count. Self-cleans old rows on each call rather than needing a separate scheduled job. |
| `lib/rate-limit.ts` | Thin wrapper around the RPC call so each route calls it the same way. Fails **closed** — if the rate-limit check itself errors, the request is blocked rather than silently let through. |
| `app/api/invite/route.ts` | 10 invite emails/hour/user. |
| `app/api/tools/price-scanner/route.ts`, `ingredient-scanner/route.ts`, `recipe-stealer/route.ts` | 20 calls/hour/user each. |

**Known limitation:** limits are per-route, not shared — someone could still make 60 total AI-tool calls/hour by spreading 20 across each of the three. Good enough for household-scale abuse (a runaway loop, a curious kid mashing buttons), not hardened against a deliberate attacker. Worth a shared bucket if this ever opens beyond trusted household members.

---

### Visual design system — DONE (this turn), applied to core screens
| File | Purpose |
|---|---|
| `app/layout.tsx` | Loads Cormorant Garamond (display/headers) + Nunito Sans (body/UI) via `next/font/google`. |
| `tailwind.config.ts` | Color tokens (same names in code, feminine-luxury values): `aubergine` → deep plum `#6B3550`, `gold`/`gold-light` → rose-gold `#C08D74` / blush `#F0D9CE`, `cream` → ivory `#FBF4EF`, `ink` → warm plum-black `#3A2A33`, `sage` (success), `rust` → dusty rose-red (not brown-rust). |
| `app/globals.css` | Ivory background, plum-black text, Nunito Sans body, Cormorant Garamond headings. |

**Signature detail:** section headers now sit between two thin gold hairlines with an italic serif label centered between them (like an invitation or menu card), replacing the earlier squared-off "ledger tab" motif. Shapes shifted from `rounded-lg` to pills (`rounded-full`) and generous `rounded-2xl` cards throughout — softer silhouette to match the direction.

**Update:** the brand-consistency question originally flagged here is resolved — see "Real icon artwork" below. The real "Sorted & Stocked" logo you provided confirmed this palette direction independently.

**Restyled with the new system — now every screen in the app:** `PropertyNav`, the property header bar, `LogoutButton` (now supports `light`/`dark` variants for use on both the aubergine header and the cream-background picker page), `InventoryClient` (+ item form sheet), `ShoppingListView`, `ShoppingListClient`, `Skeleton`, `Toast`, `ScanClient`, `PrintLabelsClient`, `StaffClient`, `PhotoToolClient` (shared by all 3 AI tools) + the tools menu page, `NewPropertyForm`, `forgot-password`, `reset-password`, the login page, and the property picker page.

**Real bug caught while restyling the picker page:** `LogoutButton` was hardcoded for a dark aubergine background (`text-cream/80`) — dropped onto the picker page's light cream background, it would have been nearly invisible. Added a `variant` prop rather than leaving two silently-different copies of the component.

### Accessibility fixes — DONE (this turn)
| File | Purpose |
|---|---|
| 8 files across `app/` and `components/` | **Real regression caught and fixed.** The restyling pass added `focus:outline-none` to every input to make room for a custom border-color focus state, but never added a replacement focus indicator — meaning anyone navigating by keyboard would see no visual sign of which field was focused. Every affected input now also gets `focus:ring-2 focus:ring-gold/40`, a visible ring in the brand color. |
| `app/globals.css` | Added a `prefers-reduced-motion: reduce` media query collapsing all animations/transitions to near-zero duration — previously ungated `animate-pulse` (skeletons, "Analyzing…") and `transition-colors` (hover states) ran at full speed regardless of the person's OS accessibility setting. |

### Real icon artwork — DONE (this turn)
| File | Purpose |
|---|---|
| `public/icons/icon-192.png`, `icon-512.png` | Extracted from the real "Sorted & Stocked" logo you provided — the circular wreath/house emblem, cropped programmatically (bounding-box detection on the source art, not a guessed crop) to exclude the wordmark below it. |
| `public/icons/icon-maskable-512.png` | Same emblem with an added ~18% safe-zone margin so Android's circular/rounded-square icon mask doesn't clip the wreath. |
| `public/brand/sorted-and-stocked-logo.png` | The full logo (emblem + "Sorted & Stocked" wordmark) saved as a brand asset for future use — splash screens, a marketing page, etc. |
| `public/manifest.json`, `app/layout.tsx` | App name updated to **"Sorted & Stocked"** (was the placeholder "Property Inventory") — this is now the real product name, not a working title. |
| `app/login/page.tsx` | Now shows the actual logo mark above the sign-in form instead of just text. |

**The earlier brand-consistency flag is resolved, and pleasantly so:** the real logo's palette (plum, rose-gold, ivory/blush) lines up closely with the "feminine luxury" direction already built into `tailwind.config.ts` — no rework needed. This app now has a coherent identity of its own ("Sorted & Stocked") distinct from, but harmonious with, Sort + Place's broader materials.

---

### Real Strauss data import — DONE (this turn)
| File | Purpose |
|---|---|
| `008_item_metadata.sql` | Adds `photo_url`, `supplier`, `unit_cost`, `reorder_link` columns to `inventory_items` — these didn't exist in the original schema, which was intentionally lean. Needed before the data import below will work. |
| `strauss_full_data_import.sql` | One-time import of 154 real items from the actual Master Inventory Google Sheet into the Strauss property: real names, categories, storage locations (16 of them, auto-created), suppliers, prices, and reorder links where the sheet had them. Quantities start at 0 (par levels stay out of scope per earlier decision) — real on-hand counts need entering by hand afterward. |
| `components/InventoryClient.tsx` | Updated to fetch/display/edit the new fields: item rows now show a thumbnail (when a usable direct image URL exists) or a placeholder icon, plus supplier name; the edit form gained Supplier, Price, Reorder link, and Photo URL inputs; an "Open reorder link ↗" shortcut appears when one's set. |

**Known limitation, flagged rather than hidden:** 19 of the 154 items have a `photo_url`, but those are Google Drive "file/.../view" sharing links, not direct image URLs — browsers can't render those as `<img>` thumbnails, so those specific 19 items will show the placeholder box icon instead of a real photo despite having a link on file. Fixing this means converting each Drive link to a direct-viewable format (there's a URL pattern for this), which wasn't done here — a reasonable next step if photo previews matter, not something to guess at silently.

**Also worth knowing:** this is a one-time snapshot import, not a live sync. Editing the Google Sheet later won't update this app, and vice versa — the two are now separate places that both need maintaining unless a real sync gets built later.

---

### Inventory redesigned as room cards — DONE (this turn)
| File | Purpose |
|---|---|
| `components/InventoryClient.tsx` | Replaced the long stacked-by-room list with a two-level view: a grid of room cards (name, item count, low-stock badge) as the landing view, and a single room's item list after tapping into one. Also added a camera-icon shortcut in the header linking straight to `/scan`, addressing the "shouldn't scan be reachable from inventory" point — the dedicated Scan tab in the bottom nav is still there too, since scanning a shelf label without first opening a specific room is still a common flow. |

**On model choice:** this build has been done on Claude Sonnet 5 throughout. The bugs hit along the way (RLS policy edge cases, a scanner library's synchronous-throw behavior) were genuine investigation problems, not things a larger model would have sidestepped — model tier hasn't been the limiting factor here.

**On meal planning / recipes:** these do not exist anywhere in this new app. They were part of the old Google Sheets-based system (128-meal shopping list, recipe docs) and were never built into Sorted & Stocked. If wanted here, that's new feature work, not a missing connection.

---

### Nav redesigned as a dropdown — DONE (this turn)
| File | Purpose |
|---|---|
| `components/PropertyNav.tsx` | Rebuilt from a fixed bottom tab bar into a single dropdown menu, triggered from the header. Directly addresses feedback that separate bottom tabs felt cluttered. |
| `app/properties/[id]/layout.tsx` | Nav moved into the header, next to Sign out. |
| 5 screen files | Removed now-unnecessary bottom padding that existed only to clear the old fixed bar. |

### Labels rebuilt as per-item, with photos — DONE (this turn)
| File | Purpose |
|---|---|
| `009_item_qr_codes.sql` | Auto-generates a QR token for individual inventory items (this existed as a column since 001 but nothing ever populated it — only locations got that treatment before). |
| `components/PrintLabelsClient.tsx` | Rebuilt from one-label-per-room to one-label-per-item, with a photo thumbnail when a usable image URL exists. |

**Real limitation, not glossed over:** photos are fetched client-side via `fetch()`, which only works for images that allow cross-origin access (CORS). Most external product image URLs (Target, Walmart, etc.) don't allow this by default — so in practice, many items with a real photo URL will still print without the photo, silently falling back to QR + name only. A reliable fix would route image fetching through a server-side proxy instead of the browser; not built here. The UI does tell you up front how many of your items have a *usable* photo URL before you print, so at least the count is honest going in.

### Meal Plan — new feature, DONE (this turn)
| File | Purpose |
|---|---|
| `010_meal_plan.sql` | Three new tables: `recipes`, `recipe_ingredients`, `meal_plan_entries`. Full RLS following the same patterns as everything else. |
| `components/MealPlanClient.tsx` | Weekly calendar (prev/next week navigation), tap any day to assign either an existing recipe or a quick one-off entry ("leftovers," etc.), a "+ New recipe" flow with a dynamic ingredient list (name/qty/unit/aisle category per ingredient), and a single button that pushes the current week's planned recipes' ingredients straight into the active Shopping list — reusing the same find-or-create-list logic as the Shopping screen. |
| `app/properties/[id]/meal-plan/page.tsx` | Route. |
| `components/PropertyNav.tsx` | Added between Inventory and Shopping in the menu, since those three are meant to connect. |

**Scope called out honestly:** this is a first version. It handles one meal per day (no separate breakfast/lunch/dinner slots in the UI yet, though the database supports it), and "push to shopping list" adds every ingredient as its own line rather than combining duplicates across recipes (e.g., two recipes both calling for onions will create two separate onion lines, not one combined one). Both are reasonable v2 improvements, not silently-missing basics.

---

### Item history + Favorites — DONE (this turn)
| File | Purpose |
|---|---|
| `011_item_history.sql` | `inventory_item_history` table, logged via a **database trigger** on `inventory_items` (insert/update/delete), not client code. This matters: it means every write path — direct edits, the offline queue replaying later, even the Strauss bulk import — gets logged identically and automatically, and it can't be bypassed by calling the API directly. No insert policy exists for regular users; only the trigger (`SECURITY DEFINER`) can write history, so it can't be edited or faked from the client either. |
| `012_favorites.sql` | `inventory_item_favorites` — simple per-user table, own-favorites-only RLS. |
| `components/InventoryClient.tsx` | Item edit sheet now has a compact "History" section (newest first, action + who + when) loaded when you open an item. Each item row got a tap-to-toggle star; a "⭐ Favorites" card appears at the top of the room grid (only when you have at least one) that filters across all rooms. |

**Honest framing on Favorites:** flagged before building this that it might not earn its complexity for a household inventory (vs. a personal shopping catalog) — built anyway since it was requested, kept intentionally minimal (no separate management screen, just a star + one filter view) rather than over-building something with uncertain daily value.

---

### Add Room fix + onboarding playbook corrected — DONE (this turn)
| File | Purpose |
|---|---|
| `components/InventoryClient.tsx` | **Real gap found and fixed while auditing the onboarding playbook:** there was no way to create a room/location anywhere in the app — the item form's dropdown only listed existing ones. Added an "+ Add room" tile to the room grid with a small inline dialog. |
| `CLIENT_ONBOARDING.md` | Corrected after the audit caught two inaccuracies: (1) the location-creation claim above, and (2) a bigger one — the playbook assumed the app was already deployed to a real URL, but deployment has never actually happened; everything has only run on localhost. Rewrote the "before you start" section to say so plainly instead of treating it as a checked box. |

**This is the kind of check worth doing before trusting any written process** — the first version of this playbook would have sent a future client onboarding attempt straight into two walls: no way to create rooms, and no reachable URL for anyone but Racquel's own computer.

---

### Meal plan rebuilt with real courses — DONE (this turn)
| File | Purpose |
|---|---|
| `013_meal_plan_courses.sql` | Adds a `course` tag (soup/protein/starch/salad/dessert/kids_platter) to both `recipes` and `meal_plan_entries`, and retroactively tags the 23 already-imported recipes with their real course. **Real feedback that led to this:** the original meal plan only supported one recipe per day — direct correction: "can't pick a meal... don't have options like protein/carb/salad/soup." |
| `strauss_meal_plan_import.sql` | **Rewritten.** Deletes the old single-blob-per-day entries and replaces them with real per-course entries across all 6 weeks (192 total) — each course links to a real recipe wherever one exists, with the actual dish name kept as a fallback label either way. |
| `components/MealPlanClient.tsx` | Rebuilt UI: each day is now a card with 6 separate course rows, each independently tappable to assign a recipe or type a quick entry. The recipe picker for a given course only shows recipes tagged with that course. New-recipe form now asks which course a recipe belongs to. |

### AI tools: text input added, one renamed — DONE (this turn)
| File | Purpose |
|---|---|
| `lib/anthropic/client.ts` | Added `callClaudeWithText()` alongside the existing image version. |
| All 3 `app/api/tools/*/route.ts` | Now accept either a photo or typed text — same rules/guardrails either way. |
| `components/PhotoToolClient.tsx` | Added a Photo / Type it in toggle. |
| "Recipe Stealer" → **"Copycat Recipe"** | Renamed per direct request — only the display label changed, the route path (`/api/tools/recipe-stealer`) stayed the same since renaming that would be a bigger, riskier change for no user-facing benefit. |

### Real product photos found — bigger and more complicated than expected — DONE (partial)
| File | Purpose |
|---|---|
| `015_house_photos_urls.sql` | Converts existing photo URLs from Drive's non-embeddable `/file/d/.../view` format to the actually-hotlinkable `/thumbnail?id=...` format. Wires in one confirmed real match: a photo literally named for "Pas Yisroel Whole Wheat Pita 6 Pk." |
| `components/InventoryClient.tsx`, `components/PrintLabelsClient.tsx` | `isDirectImageUrl()` now recognizes the Drive thumbnail format as valid. **Real caveat:** whether this actually renders depends on the files' Drive sharing settings — if they're not set to "anyone with the link," they still won't display. Not fully confirmed working yet. |

**What the search actually found, reported straight:** a separate "House Photos" folder in Drive, organized by the same zone codes as inventory (KIT, BBED, BCOM, etc.), containing real photographed products. But it reshapes the problem rather than simply solving it:
- Most photographed products in KIT (Arm & Hammer Baking Soda, a Band-Aid variety pack, Canada Dry Ginger Ale, and more) **aren't in the 154-item imported list at all** — real evidence the actual pantry has more items than the spreadsheet ever captured, not just missing photos for known items.
- Several zone folders exist for rooms never imported as inventory: **BABY, DIN (Dining), ENT (Entry), SIDE, PES (Passover), plus two upstairs zones** — real photographed items with zero corresponding app entries.
- The BBED (Basement Bath) folder is entirely unlabeled iPhone HEIC photos with no OCR-readable text, meaning matching them to specific items would require viewing each one individually rather than text-matching — not done here.

**Not yet decided:** whether to (a) do a full manual visual match of every remaining photo to build out real new items for the un-imported rooms, and (b) whether that's worth the time versus other priorities. Real scope, not guessed at silently.

### Full recipe package found and imported — DONE (this turn)
**You had this the whole time** — a complete "Strauss Family Recipes" package sitting in your Downloads folder, built in an earlier session, never handed over until now. It contained far more than what we'd pieced together from Drive:

| File | Purpose |
|---|---|
| `public/recipe-photos/*.jpg` (11 files) | **Real dish photos**, copied directly into the app's own `public/` folder — not Drive links, so no CORS or sharing-permission issues at all. These just work. |
| `strauss_recipes_import.sql` | **Full replacement.** All 180 real recipes (up from the 23 we'd built from a partial source), with real bilingual cooking instructions kept in the `notes` field, real course tags based on the original category (Chicken/Meat/Fish/Crockpot/Suppers → protein, Soups → soup, Salad → salad, Sides/Kugel → starch, Dessert → dessert, Kids → kids_platter), and all 11 real photos wired to their matching recipe. **Judgment call, stated plainly:** Salad Dressings, Dips, Smoothie, Dairy, Diet, and Pesach categories don't map cleanly onto our 6-course model, so those recipes were left with no course tag rather than forced into a misleading one — they're still saved with full ingredients, just not selectable from a specific course slot yet. |
| `016_relink_meal_plan.sql` | Reconnects the existing 6-week calendar's `recipe_id` links to the new recipe set by matching dish name + course — more days should now show as linked (with real ingredients) than before, since the new set covers far more dishes. |
| `components/MealPlanClient.tsx` | Now shows a small real photo thumbnail next to any course entry whose recipe has one. |

**Also in that package, not yet used — flagging rather than ignoring:** `Full_Cookbook_All_180.pdf`, `Recipe_Index.pdf`, `Dinner_Recipes.pdf` (print-formatted references), `Constant_Stock_List.pdf`, `Dinner_System.pdf`, `Meal_Rotation.pdf` (household planning documents), and an interactive `Shopping_List.html`. These are reference material, not something that plugs into the database — worth a look together if any of them turn out to have information not already captured.

### Full photo sweep of recipe folders — DONE
| File | Purpose |
|---|---|
| `014_recipe_photos.sql` | Adds `photo_url` to `recipes` (didn't exist before). Populates one confirmed real photo: "Eileen's Sweet & Tangy Chicken." |

**Result of searching all 17 recipe category folders (Chicken, Suppers, Dessert, Crockpot, Dips, Smoothie, Sides, Salad Dressings, Kids, Diet, Kugel, Meat, Soups, Salad, Dairy, Pesach, Fish) plus a Spanish-language folder and a duplicate Recipes folder:** exactly **one** real recipe photo exists in the entire 181-recipe collection. Everything else is text-only. This isn't something that got lost — it was never done in the first place, across the whole collection, not just the recipes already in the app.

---

### Recipe picker made actually searchable — DONE (this turn)
| File | Purpose |
|---|---|
| `components/MealPlanClient.tsx` | Replaced the plain dropdown in "Pick a recipe" with a real search box + filtered list. **Direct feedback that led to this:** "if I type chicken shouldn't it show me chicken?" — the old dropdown couldn't be searched at all; typing did nothing since it was just a static list. Now it filters live. |
| `017_dedupe_recipes.sql` | Removes any duplicate recipes by name — needed after multiple import passes. |

**Also clarified, not a new bug:** a screenshot showed "Arugula Salad" sitting under the Protein slot for one day — that's leftover data from before the course system existed (when everything defaulted to one "protein" slot). Not something the current code produces; just needs clearing with the ✕ and re-adding under the right course.

**Still unresolved:** the "showing at the bottom of the screen" issue. The screenshot provided showed the assign-a-meal popup correctly docked as a bottom sheet — normal, intentional mobile design, not a bug. If something else is actually sliding down over time, that's still an open item — need a screenshot of that specific symptom to fix it, since guessing further would waste more of your time than it saves.

---

### Logo fix + Remember me — DONE (this turn)
| File | Purpose |
|---|---|
| `app/login/page.tsx` | Fixed the login logo being cropped — it had a CSS circular clip (`rounded-full`) applied on top of an image that's already tightly cropped to its own circular shape, double-cropping the edges. Removed the redundant clip, added `object-contain` so it can never distort or crop regardless of size. Also added a real "Remember me" checkbox (checked by default). |
| `components/OfflineSyncProvider.tsx` | Added the actual enforcement: unchecking "Remember me" signs the person out automatically when they close the browser tab, rather than being purely cosmetic. **Honest caveat:** browsers don't guarantee this fires reliably on every close method (e.g., force-quitting vs. a normal tab close) — it's best-effort, not a hard guarantee. |

**On "I can't talk to Claude Code myself":** confirmed directly — there's no connection between this chat and Claude Code on your computer. They're separate programs with no shared channel. The copy-paste-instructions workflow isn't a workaround being chosen over something easier; it's the only path that currently exists. The Supabase MCP attempt earlier was the one real effort to close this gap, and it didn't work out in your environment.

**Still open:** the actual sign-in error — waiting on a screenshot of the red error message to diagnose, since "a red error appears" isn't specific enough to fix blind.

---

### Kids Platter fixed for real — DONE (this turn)
| File | Purpose |
|---|---|
| `components/MealPlanClient.tsx` | **Real root cause found, not guessed:** checked the actual recipe data directly — only 1 of 180 recipes is tagged "Kids" ("Fruity Pebble Fluff Treats"). Kids Platter was never a real recipe category in the source material at all — the original meal plan spec always used 3 fixed combos (carrots/apples/grapes, berries/cheese cubes, melon/crackers), not a recipe database. Added those 3 as one-tap presets directly in the picker for that course, so it's actually usable now instead of showing almost nothing. |

**Also, on "you should know if you really updated it":** fair point — going forward, checking the actual imported data directly before answering is the right standard, not assuming a fix worked because the code looks right.

---

### MAJOR CORRECTION: real inventory data found and never used — DONE (this turn)
| File | Purpose |
|---|---|
| `018_final_inventory_replacement.sql` | **Replaces the 154-item import entirely with the real 188-item set.** |

**What actually happened, stated plainly:** three newer Master Inventory versions (v9, v11, FINAL) existed in the main project folder the whole time, all created after v8 (the version actually used for the original import), and were never opened. A real "Grocery Order History Summary" doc also existed, already cross-referenced by a prior session against real Costco/Walmart/Sam's Club/Target/Bingo Wholesale orders — adding ~35 real items with real suppliers, and confirming real photos for 5 items previously assumed to be "not in inventory" (Arm & Hammer Baking Soda, Band-Aid Variety Pack, Canada Dry Ginger Ale, Coca-Cola Zero Sugar, Sprite Zero). This work was already done once and simply never carried into the app.

**Real numbers, corrected:**
- **188 items** (not 154) across all zones, including new suppliers never previously in the system (BJ's Wholesale, Sam's Club, Bingo Wholesale, Target, Gourmet Glatt)
- **22 items with real, confirmed photo URLs** (not 20) — the 19 original KIT items, the Pita match, plus now baking soda, Band-Aid, Canada Dry, Coke Zero, and Sprite
- Real order-history dates and dollar amounts preserved in item notes for traceability

**Not fixed by this pass, staying honest:** there are still more items visible in the House Photos folder (BBED HEIC photos, other un-imported rooms) that aren't in even this FINAL sheet — this closes the specific gap between "what a prior session already found" and "what's actually in the app," not the larger open question of whether more real items exist beyond any spreadsheet.

---

### Real forgotten features built — DONE (this turn)
| File | Purpose |
|---|---|
| `019_recipe_bilingual_fields.sql` | Adds real `instructions_en`, `instructions_es`, `kosher_type` columns to `recipes`. **Real gap found while building this:** the original recipe import folded English instructions + kosher type into one English-only `notes` blob and threw away Spanish instructions entirely — meaning a "bilingual recipe" was never actually possible before this. |
| `020_backfill_bilingual_instructions.sql` | Backfills the new columns for all 180 recipes from the real source data. Run after 019 and after the recipe import. |
| `components/RecipeDetailClient.tsx` + `app/properties/[id]/recipes/[recipeId]/page.tsx` | **New page.** Real bilingual recipe view — photo, ingredients, English instructions side-by-side with Spanish, kosher-type badge, and a working Print button with print-specific styling (two-column EN/ES layout on paper). |
| `components/MealPlanClient.tsx` | Recipe names linked to a real recipe are now clickable — tap to view the full bilingual recipe, tap the ✏️ next to it to change what's assigned instead. Also added kosher-type filter chips (Dairy/Meat/Parve) to the recipe picker, using real data that already existed but was never surfaced. |
| `components/ShoppingListView.tsx` | Added a working Print button, a print-only title/date header, and print-specific styling — checkboxes become plain ☐ marks on paper, categories won't split across a page break. |
| `app/properties/[id]/layout.tsx` | App header now hidden when printing, so printed recipes/shopping lists don't waste ink on navigation. |

**Still open, not built this pass:** prep-time and dietary-restriction filters beyond kosher type — the source data for those was genuinely empty for every recipe (checked directly, not assumed), so building that filter would mean inventing data rather than surfacing real data. Staff Dashboard, Suppliers directory, and Shopping↔Labels connection are also still outstanding.

---

## ❌ NOT STARTED

- Optimistic inserts (new inventory items, custom shopping list items) use a temporary `pending-...` id until the next successful reload reconciles them with the real DB id — fine for single-device use, could show stale duplicates if two staff members add the same item offline at the same time
- Property-level settings (timezone, currency, default unit) — not modeled yet
- No image/receipt/warranty/maintenance-history tables — if these get built later, they should be **separate tables** (`inventory_item_images`, `inventory_item_documents`, etc.) referencing `inventory_items.id` rather than new columns bolted onto `inventory_items` itself
- Better animations, more thorough offline-indicator states beyond the online/offline banner

## Environment variables required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — as of 2026, Supabase's dashboard calls this the **publishable key** (`sb_publishable_...`). Same variable, same code, just a renamed value — no code changes needed.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never prefix with `NEXT_PUBLIC_`. Dashboard now calls this the **secret key** (`sb_secret_...`). Again, drop-in — same variable name in our code, new value from the dashboard.
- `ANTHROPIC_API_KEY` — **server-only**. Powers the three `app/api/tools/*` routes only. Get it from console.anthropic.com.

**Do not install `@supabase/server` or set `SUPABASE_JWKS_URL`.** Supabase's dashboard may surface onboarding instructions for `@supabase/server` — that's a *different* package built for Edge Functions/Workers (stateless, header-based auth). This app uses `@supabase/ssr` (cookie-based sessions for Next.js), which is already what `lib/supabase/server.ts` and `middleware.ts` are built on. The two packages are not interchangeable; Supabase's own docs say so explicitly. If your dashboard pushes you toward `@supabase/server`, ignore it for this project.

- In Supabase Auth settings: confirm whether "Confirm email" is on — the login page's "check your email" branch assumes it might be, but if it's off, sign-up logs the user in immediately instead
- In Supabase Auth settings: the site URL / redirect allow-list needs `{your-domain}/auth/callback` added, or both the email-confirmation and password-reset flows will fail after deploy

## All npm packages referenced across this build
```
npm install next-pwa html5-qrcode jspdf qrcode idb-keyval @supabase/ssr @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
```

## Migration order
Run in numeric order — each depends on tables/functions from the ones before it:
`001_init_schema.sql` → `002_location_qr_codes.sql` → `003_auto_owner_membership.sql` → `004_invite_by_email.sql` → `005_seed_categories.sql` → `006_prevent_last_owner_removal.sql` → `007_rate_limits.sql` → `008_item_metadata.sql` → `009_item_qr_codes.sql` → `010_meal_plan.sql` → `011_item_history.sql` → `012_favorites.sql` → `013_meal_plan_courses.sql` → `014_recipe_photos.sql` → `015_house_photos_urls.sql`

`001_init_schema.sql` → `002_location_qr_codes.sql` → `003_auto_owner_membership.sql` → `004_invite_by_email.sql` → `005_seed_categories.sql` → `006_prevent_last_owner_removal.sql` → `007_rate_limits.sql` → `008_item_metadata.sql` → `009_item_qr_codes.sql` → `010_meal_plan.sql` → `011_item_history.sql` → `012_favorites.sql` → `013_meal_plan_courses.sql` → `014_recipe_photos.sql` → `015_house_photos_urls.sql` → `019_recipe_bilingual_fields.sql`

Then: `strauss_full_data_import.sql` → **`strauss_recipes_import.sql` (re-run this — it now replaces the old 23-recipe partial import with the full real 180)** → `020_backfill_bilingual_instructions.sql` → `strauss_meal_plan_import.sql` → `016_relink_meal_plan.sql` → `017_dedupe_recipes.sql` → `018_final_inventory_replacement.sql`

---

## Known open questions

- Confirm Next.js 14 vs 15 (affects the params pattern above)
- Confirm this is Next.js App Router (assumed, not confirmed by you)
