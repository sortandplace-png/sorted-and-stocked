# Handoff — 28 July 2026

Written at the end of a long session, for whoever picks this up next. Read
`work_items` and `design_rules` in Supabase first; this file is the map, those
two tables are the authority.

---

## State

- `main` at **`f0135f3`** (Merge PR #19). **All 21 commits from the 28 Jul
  session are merged and deployed to production.** Nothing is waiting.
- `feat/staff-cleanup` is behind `main` — start a new branch, don't reuse it.
- `sop-posters` bucket: **76 objects**, no strays.
- **Standing instruction: finish visible work → open the PR → merge it.**
  "Shall I open a PR" is not a decision worth asking about.

### Deploy state (28 Jul) — verified, not assumed

PRs #17, #18 and #19 merged; every Vercel build **Ready**, `main` deployed
to Production. The 13-failure run recorded in SS-236 is over — the
"failed to deploy" notices in the Vercel inbox are all a day old.

**Verified against production, not inferred:** fetching
`https://www.sortandplace.com/login` and searching the payload finds
`linkHouseManual`, `showProcedure`, `deployFromLibrary`,
`statRoomsMissingHint`, `templateDinnerStaged` and `alsoDidPlaceholder` —
strings added in the last commits of the session, including the handbook
one. Note the redirect: `sortandplace.com` 308s to `www.`, so probe the
`www.` host or you'll read a redirect as a failure.

**This probe is the cheap standing answer to R4/SS-010-R.** Pick a string
your change added, fetch the live login page, and grep for it. It costs
one call and it distinguishes "committed" from "actually live" — which is
the exact gap SS-236 was about.

### What was still open at end of session

**Screenshots.** Nothing here was seen rendered. Every check was code,
schema, payload or measurement. Highest-value things to actually look at:
the roster page (SS-156 Phase 2 rebuilt it), the handbook (SS-150 rebuilt
it), the My Day clock control and the Hours page — the last two being
brand-new UI nobody has viewed.

**Local dev server.** Port 3000 is held by another chat's server and the
preview tool refuses a second one even against this repo's own `dev:agent`
config; port 3100 answered 500 and belonged to another process. If you hit
this again: the same payload probe works against `localhost:3000` and will
tell you whether that server is even serving this checkout — on 28 Jul it
was not.

**GitHub token.** Not reachable from a shell: no `gh`, no `GITHUB_*` in
the environment or `.env.local`, no `~/.git-credentials`, no
`gh/hosts.yml`, `credential.helper` unset — yet `git push` authenticates
fine. Pushing works; opening a PR from the CLI does not. Worth writing
down where that credential actually lives.

---

## What was done on 28 July

All merged to `main` and live in production. Typecheck-clean, and verified
live by payload probe — but **none of it seen rendered**. Reviewed in
commit-message detail, summarised here:

| Commit | Item | Note |
|---|---|---|
| `e8ba66a` | SS-274 "Also did" | **Superseded same day by SS-295 — see below** |
| `7506325` | SS-244 + SS-291 | See the corrected premise below |
| `5ae782d` | SS-287 Rosh Chodesh | Verified by execution, not inspection |
| `20ff003` | Rooms Missing | Stat goes to **0** at both properties |
| `5050ba9` | SS-293 captions | Ships dormant — no `.vtt` exists yet |
| _(next)_ | SS-295 "Also did" field | Real column; **removed SS-274's line** |

**SS-274 → SS-295 in one day.** SS-274 said "free text, no new table, and if
it ever needs structure that's a separate decision", so it shipped as a
fourth line in the note template. SS-295 *is* that separate decision:
`shift_handovers.also_did` is live (verified), so it is now a real labelled
field. **The template line was removed** — leaving both would have asked
staff to type the same thing twice, in two places, only one of which is
stored. The `shiftHandover.alsoDid` message key survived and was repurposed
from a template line ("Also did:") to the field label ("Also did"), with a
new `alsoDidPlaceholder` beside it. Both locales.

**Three premises in the last handoff were wrong.** This is the fourth time
running that register claims have not survived checking (see Traps):

- **"`task_completions` — nothing writes to it" is FALSE.** `markDone` has
  always upserted to it. The table is empty because nobody has used it. The
  real bugs were that a ticked task *vanished* from My Day and there was no
  way to untick — a different fix entirely from the one implied.
- **"in late December `year + 1` may not reach the next Rosh Chodesh" does
  not reproduce.** Checked from 2026-12-20, -12-28 and -12-31: the next
  occurrence resolves every time. No change needed.
- **`TrainingClient.tsx`'s own header comment was false** — it claimed the
  `<video>` "already renders a `<track>` when a captions file exists". There
  was no `<track>` in the file at all, so the long-standing note that Spanish
  captions were "a content task, not a code change" was wrong. It is true
  *now* (SS-293), and the comment is corrected.

## The queue, in order

**Items 1–6 and both smaller items below are DONE except where marked.**
Remaining: **SS-150 handbook**, **the nine PNGs**, **Recipe Ingredients →
Staples**, **SS-156**. All four are visual work needing a browser.

### 1. SS-286 structural — Shop page
An expanded category still renders **inside its 3-column grid cell**. That is
the root cause, not the width. Consequences: names truncate, the other two
columns hold dead space, item cards are ~100px on a phone.

- An expanded category takes the **full container width**; others collapse
  above/below, or it opens in a sheet. It stops being a grid cell when it opens.
- **One column on mobile, always.**
- **Category titles never truncate** (one was rendering as the single letter "B").
- Units and quantities need their own space — "pcs" was overlapping "1v".
- Item rows and category cards must not interleave in the same columns.

Already done: product names got `line-clamp-2 break-words` (`bf7f3cc`) so four
different chickens no longer all read "Chicken …". That was the correctness
half only.

### 2. SS-287 — Dashboard picks the wrong Rosh Chodesh
`lib/calendar-trigger-type.ts`, `getRoshChodeshStatus()`, **line 275**.

`byTitle` groups by event title across a two-year fetch, so "Rosh Chodesh
Sh'vat" 2026 and 2027 merge into one group. That group starts in January 2026
(sorts ahead of Elul) and ends January 2027 (passes the `>= today` test), so
Sh'vat wins months before Elul is considered.

**Fix:** sort events by date, walk them accumulating a group while each date is
the previous + 1 day; start a new group otherwise. Everything downstream —
`find`, `first`, `isToday`, `daysUntil` — works unchanged.

Also check the two-year window: in late December, `year + 1` may not reach the
next Rosh Chodesh.

The wiring is fine — the dashboard does call this (page.tsx:682, renders at
818–819). R1 does not apply; it already computes from Hebcal. `hebrew_month` is
not involved, so this is not SS-065's root.

### 3. SS-150 — Handbook upgrade
`components/StaffHandbookClient.tsx`. Bento grid is correct and approved —
don't redesign it.

- **Links** via `lib/app-routes.ts` (exists at `6416f4c`, imported by nothing).
  Routes are **property-scoped**: `/properties/[id]/my-day`. There is no
  `/staff/my-day` and no `/search` (search is a header component).
  `houseManual` → `/tools/knowledge-base`, **not** the title-derived path,
  which 404s.
- Denim `#2E4A62`, underlined on hover, **never brass** (D-01).
- **Icons**: one lucide line icon per question, its own set — `DoorOpen`,
  `ClipboardList`, `Search`, `ArrowLeftRight`, `Flag`, `BookOpen`. Not the
  shopping-category PNGs; a milk bottle beside "what do I do first" means
  nothing.
- **Hairline `#E8DDD0` divider** between question and answer.
- **Inline SOP posters** where an answer maps to one — 47 hosted posters, 77
  links across 66 tasks. Expandable.
- Collapsed by default, live search, progress count.
- **SS-224**: the question count renders twice; the older one is English-only.
- **Park the videos** — nothing exists to embed. Build the slot empty.

### 4. Task tile images — SS-124 / SS-162
`master_tasks.photo_url` (24 tasks) and the attached SOP's
`expected_appearance_url` (47 posters, 77 links via `master_task_sops`). Both
are live public URLs. Neither renders on a task.

Two different pictures with two different meanings: the task illustration is
*what this job is*; the SOP poster is *what finished looks like*. A tile may
show both. Never conflate them.

Racquel: *"we need to get these to staff duty."* A poster in a library nobody
opens is worth nothing.

**Do not enable `photo_verification`** — 21 SOPs have it set and it needs her
sign-off that the references are right.

### 5. Staff can complete a task — SS-244
`task_completions` is fully built and has **zero rows**. Nothing writes to it.

- Checkbox per task on My Day → insert with `completed=true`,
  `completed_at=now()`, `completed_by=auth.uid()`, `due_date=today`.
- Tapping again sets `completed=false` — **never delete the row** (R21).
- Completed tasks stay visible, struck through or dimmed. Don't vanish them.
- `photo_url` and `note` exist on that table — wire the existing Capture button.

**RLS is already correct.** INSERT was tightened to assignee-or-manager using
`is_assigned_to_task()`. Don't rewrite the other three policies; they're right.

### 6. "Also did" on Shift Handover — SS-274
A third labelled field beside What's Done / In Progress / Heads Up:
**"Also did / También hice."** Free text. **No new table.** If it needs
structure later that's a separate decision.

### Also open, smaller
- ~~**Rooms Missing stat**~~ — **DONE (`20ff003`).** The trap was real:
  `source_area_en` really was missing from the select and the `Task` type,
  and was added first. But the outcome is bigger than the ticket:
  **every single room-missing task at both properties is area-level.**
  Lax **75 → 0**, Main **16 → 0**. That stat has never once pointed at a
  real data gap — it was counting deliberate exclusions and showing them as
  outstanding work. Because the tile now reads 0 everywhere, the
  explanation is what makes the zero legible rather than looking like a
  broken counter. **Deviation to confirm with Racquel:** she asked for a
  tooltip; it renders as a caption *and* a `title` attribute, because a
  hover-only tooltip tells a phone user nothing. Easy to drop the caption.
- **Nine PNGs, zero wired.** `CATEGORY_ICON_SRC` beside the existing
  `STORE_ICON_SRC` (`ShoppingListViewEnhanced.tsx:97`), same `<img>`-or-fallback
  shape as line 948. Four toggles at **lines 880–884** currently use lucide
  components — that array is `[option, Icon, label]` and needs a src instead.
  Add `Seasons: '/store-icons/seasons.png'` to `STORE_ICON_SRC`.
- **Match Recipe Ingredients to Staples.** Staples is the approved design.
  They live in **different components** — Staples in `StaplesTab.tsx`, Recipe
  Ingredients inside `ShoppingListViewEnhanced.tsx` — so "match them" means
  porting the card shape, not editing one shared file.
- **SS-156** — the four-page merge into `/staff/tasks`. Largest item. Read
  SS-274 first: **Task Center is owner/manager only**, staff see My Day, SOP
  Library, Training Videos, Staff Handbook. Staff are not barred from reference
  material — the handbook tells them to check the SOP.

---

## Traps that cost real time tonight

- **Grep defaults to the wrong directory.** Always pass an explicit `path`. A
  control search for a file you know exists is worth one call.
- **A string-replace across similar classNames silently skips variants.** The
  width fix replaced `max-w-md lg:max-w-6xl` in five places and missed a bare
  `max-w-md` — the one wrapper that mattered. Afterwards, grep for what should
  be *gone*, not for what changed.
- **Check the expanded state, not just the collapsed one.** Collapsed looked
  survivable; expanded was clipping names mid-word.
- **JSX comments cannot go directly after `&& (`.** Broke a file twice this way.
- **Read the thing that already exists before adding a parallel one.** Added
  `PinDot` beside `PinAccent`; proposed a migration when `task_assignments`
  already existed. Both cost a round trip.
- **Verify a write in a separate call**, and confirm the rollback actually
  rolled back.
- **Supabase service key is the new `sb_secret_` format**, not a JWT. Storage
  rejects `Authorization: Bearer` with "Invalid Compact JWS" — use the
  **`apikey`** header.
- **Object keys can't carry an em dash.** A poster upload 400'd on it.
- **Premises from the register have been wrong repeatedly** — `tasks_read` was
  over-granting not blocking; the Tools gate was already correct; SS-118's rule
  already existed unwired in `lib/shabbos-validation.ts`; and on 28 Jul,
  "nothing writes to `task_completions`" was false while
  `TrainingClient`'s own comment claimed a `<track>` that did not exist.
  **Verify security, "nothing reads it" and "already handled" claims before
  building on them.** Checking costs one query. Not checking cost a
  rewrite of the wrong thing.
- **Specs have arrived twice, byte-identical.** SS-291 was sent, worked, then
  sent again unchanged. Check whether a "new" instruction is actually new
  before redoing work; say so rather than silently redoing it.
- **A `<track>` needs a CORS-enabled media element.** Cross-origin text
  tracks are only fetched when the `<video>` carries `crossOrigin`. Set, but
  **unverified** — no `.vtt` exists to test with. If the first uploaded
  caption doesn't appear, look there and at Supabase's CORS headers before
  suspecting the file.
- **Two training pages exist.** `tools/training` is a redirect stub;
  the real one is `app/properties/[id]/staff/training/page.tsx`. MyDayClient
  still links to the `tools` path, so staff take a redirect every visit.
  Harmless, worth tidying.

---

## Verified numbers — don't re-derive

- `master_tasks`: **168 active** (not 174 — recounted 28 Jul). 24 have `photo_url`.
- `sop_library`: 55 SOPs, 47 with posters. `master_task_sops`: 77 links / 66 tasks.
- **Task tile images now render for 67 of the 168** — 24 own photo, 43
  poster-only. The other 101 render no element at all, so no placeholder gap.
- **`deployedCountBySopId` undercounts, confirmed.** It keys off the legacy
  `master_tasks.sop_id`, which is set on **exactly 1** active task, while the
  real links live in `master_task_sops` (77 across 66 tasks). So the
  "Deployed ×N" badge is missing on ~65 of 66. **Left unfixed deliberately**
  — Racquel asked for a report, not a fix.
- `task_assignments`: assignment round trip **tested and working**.
- `task_completions`: **0 rows — but the write path works.** Unique
  constraint `(task_id, due_date)` exists, RLS INSERT is
  manager-or-assignee, UPDATE allows the assignee (so untick works without
  policy changes). Empty because unused, *not* because it is unwired.
- `training-videos` bucket: **the six .mp4s and nothing else.** No `.vtt`.
  SS-293's caption plumbing is live but dormant until one is uploaded.
- Inventory: Main 1,106 items / 1,023 never counted / 4 low. Country 467 / 467 / 0.
  **Lax has no inventory rows** and needs a deliberate empty state.
- `meal_plan_entries`: 4,428 rows, all `dinner`. Migration 133 added the
  Jewish-calendar slots; **the UI is the actual fix and is not built.**
- Main has **no staff accounts**. Everything above can ship and no housekeeper
  at Main can open it until someone is hired and invited. "Staff area done"
  will not mean "staff using it."

---

## Standing rules

`design_rules` D-01…D-22 is authoritative. Most-violated tonight:

- **D-01** — brass never above 20px, never a fill. Brass on a 1.2–1.5px stroke
  is an accent; brass filling a glyph is a fill at any size. Violated three
  times in two days (handbook numerals, room icons, a stat number).
- **D-21** — the gold pin dot **is** the collapse control. No chevrons or
  arrows anywhere. Nav dropdown chevrons and `<select>` carets are exempt —
  they signal a menu, not a collapse.
- **D-22** — a card reads as a card. Never a wide short strip.
- **R19** — bilingual at creation, both keys in the same commit.
- **R21** — never delete. Deprecate, supersede, unpublish.
- **R4** — typecheck is not done. A screenshot is done.
