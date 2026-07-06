# New Client Onboarding — Playbook

This is for bringing a **new household onto the already-running app** — not
for rebuilding or redeploying anything. Because the app is multi-tenant
(built into the schema from day one), a new client is just a new
**property** inside the same live app. No new code, no new database, no
new hosting. If any step below starts to feel like it needs a code change,
that's a sign something's actually broken — flag it rather than working
around it by hand.

---

## Before you start — this is not yet true, do this first
**The app is not deployed anywhere yet.** Every step below assumes it's running at a real web address (like `sorted-and-stocked.vercel.app`) that a client's staff could open on their own phones. As of this writing, it only runs on `localhost` on your computer via Claude Code's dev server — nobody outside your machine can reach it.

**Before onboarding a single real client, this needs to actually happen:**
1. Deploy to Vercel (SETUP.md step 9 covers this — it was never executed)
2. Add the same environment variables to Vercel's project settings
3. Update Supabase's redirect URL allow-list to include the production domain

Don't run this playbook against localhost with a real client. Get it deployed first.

- [ ] The app is live at its real deployed URL (confirmed above, not assumed)
- [ ] You (Racquel) already have an account and are signed in.

## Step 1 — Create the property
1. Sign in → Properties list → "+ Add a property"
2. Name it after the household (e.g. "Cohen Residence")
3. You're automatically the **owner**

**Time: 1 minute.** Verified working end-to-end (tested live with "test house" and "Strauss").

## Step 2 — Set up storage locations (rooms)
Before adding items, create the rooms/areas you'll be organizing:
Kitchen Pantry, Refrigerator, Freezer, Linen Closet, etc. — whatever this
specific household actually has.

In Inventory, tap the dashed **"+ Add room"** tile in the room grid, name it,
save. Repeat for each room.

*(This didn't exist until just now — an earlier version of this playbook
incorrectly said you could add a room through the item form, which was
never true. Caught and fixed before it caused a problem with a real client.)*

**Time: 5–10 minutes depending on household size.**

## Step 3 — Get inventory data in
Two paths, pick based on what you're starting from:

**A) You're building the inventory from scratch on-site**
Just use "+ Add item" in the app directly while walking through the house.
Real-time entry — no separate spreadsheet needed.

**B) You already have an existing spreadsheet for this client**
(the way Strauss's Master Inventory sheet already existed before this app did)
This is the reusable part — the exact same pattern used for Strauss's
`strauss_full_data_import.sql` works for any future client:
1. Get the client's inventory into a simple spreadsheet with columns: item name, category, room/location, (optionally: supplier, price, reorder link, photo URL)
2. Bring that spreadsheet into a chat with Claude and ask it to generate an import SQL file in the same format as `strauss_full_data_import.sql` — reference that file directly as the template
3. Run the generated SQL in Supabase's SQL Editor, same routine as every other migration: paste, Run, confirm "Success"

**Time: varies wildly — 20 minutes for a small household typed in by hand, longer if importing hundreds of items from a legacy spreadsheet.**

## Step 4 — Invite the household's staff
Staff screen (in the menu) → "Invite someone":
- If they already have an account: enter their email, pick a role (Manager or Staff), done
- If they don't: same screen offers to email them a signup invite automatically

**Time: 2 minutes per person.** Built and code-complete; not yet exercised end-to-end with a real second person accepting an invite — worth treating your first real invite as a test, not an assumption.

## Step 5 — Print labels
Once real inventory exists with real names, go to "Print labels," select the
items you want physical stickers for, generate the PDF, print on Avery 5160
sheets.

**Time: 5 minutes to generate, plus however long printing/sticking takes.** Same caveat as Step 4 — built, not yet confirmed by actually printing a real sheet.

## Step 6 — Optional: Meal plan
Only if this client wants it. Otherwise skip — not every household needs it,
and there's no cost to leaving it unused. Also not yet used with real data end-to-end.

---

## Total time estimate for a typical new client
- **Small household, built from scratch in-app:** ~30–45 minutes
- **Larger household, importing an existing spreadsheet:** ~1–2 hours,
  most of which is preparing the spreadsheet, not using the app

## Things that would make this faster if this becomes frequent
Worth genuinely considering only once you're doing this often enough that
the friction is real, not preemptively:
- A generic spreadsheet-upload feature in the app itself, instead of asking
  Claude to hand-generate SQL each time
- A "starter location set" template (common rooms pre-filled) to speed up Step 2

Don't build these speculatively — build the first one the moment it's
actually annoying twice in a row, not before.
