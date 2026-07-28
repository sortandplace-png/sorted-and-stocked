# Handoff — 28 July 2026

Written at the end of a long session, for whoever picks this up next. Read
`work_items` and `design_rules` in Supabase first; this file is the map, those
two tables are the authority.

---

## State

- `main` at **`bf7f3cc`**. Working tree clean, no open PRs, nothing unmerged.
- `feat/staff-cleanup` is behind `main` — start a new branch, don't reuse it.
- `sop-posters` bucket: **76 objects**, no strays.
- You have a GitHub token with Contents + Pull requests write.
  **Standing instruction: finish visible work → open the PR → merge it.**
  Don't leave it on a branch waiting for a word. "Shall I open a PR" is not a
  decision worth asking about.

---

## The queue, in order

Nothing below waits on a decision. All five are fully specified.

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
- **Rooms Missing stat** — Racquel ruled **exclude**, with a tooltip saying
  area-level tasks are intentionally excluded:
  ```ts
  const NON_ROOM_AREAS = ['Maintenance', 'Childcare', 'Outdoors'];
  ```
  **Trap:** `source_area_en` is **not** in DutyRosterClient's select and not on
  its `Task` type. Add it in both places first, or the filter silently matches
  nothing and the count stays wrong while looking fixed.
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
  already existed unwired in `lib/shabbos-validation.ts`. **Verify security and
  "nothing reads it" claims before building on them.**

---

## Verified numbers — don't re-derive

- `master_tasks`: 174 active. 24 have `photo_url`.
- `sop_library`: 55 SOPs, 47 with posters. `master_task_sops`: 77 links / 66 tasks.
- `task_assignments`: assignment round trip **tested and working**.
- `task_completions`: 0 rows.
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
