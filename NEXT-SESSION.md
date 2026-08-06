# Directions for the next session

Written 6 Aug 2026 at the end of a long session, for whoever picks this up.
Read this before touching anything. Most of it is things that cost real time
to learn.

---

## Decisions made 6 Aug. Do not re-ask. (SS-758, SS-759)

- **Blog inline images go in the repo** at `/public/images/`, converted to
  **webp and optimised**. Not a bucket. Every inline image already served is a
  repo path; git gives the audit trail SS-675 says headers lack; Next.js
  optimises them, which helps SS-530. **Do not commit raw jpeg.**
- **Pins go to storage**, under a `pins/` prefix. Pinterest fetches from a
  public URL and a pin is not site content.
- **Headers stay in the `marketing` bucket.** Separate job, out of scope.
- **`walk-in-closet-testimonial-graphic.jpg` exists** in Drive as
  `Walk-in_closet_testimonial_graphic_202608041349.jpeg`. Only
  `universal-housekeeping-sop-template.jpg` is genuinely absent.
- **blog-40's low-stock section was rewritten 6 Aug** and verified clean — zero
  banned phrases, internal link intact, no dashes. **The section only.** The
  post's FAQ still said "setting up thresholds" and "written thresholds", in
  `body_markdown` *and* in `faq_jsonld`; the 6 Aug check read the section, not
  the post. See §6.
- **What "low" actually means, verified in code and live 6 Aug.**
  `public.is_inventory_item_low()` (migration 158, mirrored in
  `lib/low-stock.ts`): `min_qty` set **and** `current_qty <= min_qty` **and**
  `auto_restock_eligible` **and** counted by a person at least once. So low is
  measured against a per-item minimum that **ships with the item** — live, all
  3,563 items carry one (1 to 6, five distinct values, none null or zero), and
  **no person has ever changed one in the app**: all 2,569 `min_qty` history
  rows have a System / Direct Database Access actor. Never-counted is
  deliberately not low; it is its own state. `blog_rules.no_par_levels_ever`
  says the same thing: noticing what is low is in scope, setting the level is
  not. **Copy may say what low is measured against. It may not hand the reader
  a number to set.** There is no consumption-history learning anywhere in the
  build — do not write that the system learns your rhythm.

**Sweep `/public/images/` before downloading anything.** Every file already
there is one nobody has to move.

Order of work: match by computed transform → convert → commit blog images →
write `generated_asset_url` → **pins last**, into `pin_queue`, approved rows
only. Then item 7, then the seven migration files.

---

## 0. Do this first, every time

```bash
git fetch origin && git reset --hard origin/main
```

**A checkout verified this morning is not a baseline this afternoon.** This
session started 172 commits behind and the first twenty minutes of work were
wasted concluding that files "did not exist" when they were simply not in the
stale tree. Another session also pushes to `main` concurrently: one commit
today arrived byte-identical to one being written, and four register ids
appeared mid-write. **Fetch before starting and before pushing.**

Report to the **register** (`work_items`), not to chat.
- **OMIT the `id` column** — it defaults from `next_work_item_id()`.
- `evidence='verified_live'` requires `verified_how` (there is a CHECK).
- **Never close a row.** Front-end rows close only on Racquel's on-device
  screenshot.

---

## 1. The standing instruction that matters most

**Verify every premise against live data before accepting it.** Several defect
reports this session were wrong, and catching them changed the work:

- "All four printables 404" — they returned **200**. They are 4KB stubs. A
  different defect needing a different fix.
- "None of it is live" — production was **already deploying**; Vercel
  auto-deploys `main`.
- "The renderer only has `beside` with no side" — it had **both sides** all
  along.
- "`content_prompts.asset_file` doesn't resolve" — **there was no `asset_file`
  column**. The filenames were not in the table.
  **Superseded 6 Aug: the column now exists and is populated on all 66 rows.**
  Whoever added it did so mid-session. Do not go looking for an external
  manifest — the filenames are in the table. See §5a.
- SS-641's graphic was reported outstanding; it was **byte-identical** to what
  had already shipped.

This is expected and welcomed. Say so plainly, with the evidence, then do the
real work underneath.

---

## 2. Environment facts, learned the hard way

| Thing | State |
|---|---|
| `ffmpeg` | **NOT installed.** Cannot strip audio or verify video dimensions. |
| Python / PIL | **NOT installed.** `to_letter.py` cannot run. |
| `sharp` | Available (libvips 8.17.3), now a **direct** dependency. |
| `pdf-lib` | Added as a direct dependency. |
| `scripts/to-letter.mjs` | **Working Node port**, proven to emit exactly 612x792pt. |
| Drive MCP | Returns files as **base64 into context**. A 594KB image eats most of a session. **Do not pull binaries through it.** |
| Supabase secrets | **No tool writes them.** CLI or dashboard only. |
| Browser OAuth | **Never authenticate as Racquel.** Pinterest OAuth needs her. |

**Get binaries to `C:\Users\rockl\Downloads\` and read them from disk.** That is
the only path that works at scale.

---

## 3. Database gotchas that already bit

- **`apply_migration` does NOT write a repo file.** Every migration must also
  be written to `supabase/migrations/`. This is the recurring drift (124,
  184-187, and now **200-203 and 205-207 are applied live with no file**).
- **Naming a column in an INSERT and passing NULL BYPASSES its DEFAULT.**
  `recipes.servings` (4), `is_pesach`/`is_yom_tov` (false),
  `inventory_items.current_qty`/`min_qty` (0), `unit` ('pcs') are all NOT NULL
  *with* defaults, so they never appear in a "required columns" query. Coalesce
  explicitly.
- **`master_tasks.task_number` generator is BEHIND the table.** Max is
  `T-01034`; the default offered `T-00965` and collided. Assign explicitly from
  `max()` until someone repairs the generator.
- **`properties.calendar_layers` is `text[]`, not jsonb.** Use
  `'jewish' = any(calendar_layers)`.
- **Bilingual triggers are real.** `enforce_task_bilingual` and the recipes
  equivalent RAISE without `task_es` / `name_es`. Any form that proposes
  content must collect Spanish.
- Postgres **forbids subqueries in CHECK constraints** (0A000). Normalise with
  a trigger instead.
- Multi-statement `execute_sql` returns **only the last result set**. Split
  when you need to see earlier ones.

---

## 4. Verification habits that caught real bugs

- **Measure rendered line boxes, not markup**, for anything about layout.
- **`curl` cannot see `next/script` `afterInteractive` inline scripts.** The
  Pinterest tag looked absent via curl and was fine in a browser. Use the
  browser.
- **Check counts against the expected number.** Henderson came out at 200 tasks
  when 167 was expected — a cross join. Success from the tool is not success.
- **Test destructive SQL in a transaction and ROLL BACK first.** The bio strip
  was proven with rule counts across every row before applying.
- Prove a guard **fails** as well as passes (the dash check was verified to
  reject a marketing dash *and* ignore one in a comment).

---

## 5. THE BLOCKER, and the one action that clears it

**SS-756.** The pins, blog inline images and printables are all stalled for one
reason: **the assets were made and never moved into the system.** `marketing`
has 73 objects, none of them the 31 pins or 32 blog images. `blog-images` does
not exist as a bucket. They are all in Drive folder
`1vCzdn7Joi7rdiz4b20ojUngf5xUT-IjA`.

Manifest names are **truncated generator exports** (~32 chars, lowercased,
hyphenated). Match by *computing that transform over the real filenames*, not
by eye. Flag anything that does not match uniquely.

**Racquel downloads the folder to `C:\Users\rockl\Downloads\`.** Then it is
mechanical.

**Both open questions are now answered — see the decisions block at the top.**
Destination is settled (repo for blog, `pins/` for pins) and the already-served
sweep is a standing instruction, not a one-off check.

---

## 5a. What `content_prompts` actually contains (verified live, 6 Aug)

Query it yourself before trusting any of this, but as of writing:

| Fact | Value |
|---|---|
| Rows | **66** — 35 `blog_post`, 31 `pin` |
| `asset_file` populated | **66 of 66** |
| `generated_asset_url` populated | **4**, all `/images/…` paths |
| Approved blog rows still unmapped | **30** |
| Approved pins | **30** (+1 rejected = 31) |
| Files in `/public/images/` | **5 images**, each as `.png` + `.webp` |

Three traps in that data:

1. **`asset_file` is not unique.** 24 filenames appear on two rows — normally
   the `blog_post` row and the `pin` row for the *same* post, which is fine and
   expected. **Two pairs cross posts**, and they cross with each other:
   `olive-oil-bottle-stop-buying.jpg` is on `pin:blog-21#4` and
   `blog_post:blog-22#1`, while `family-home-inventory-setup-prot.jpg` is on
   `blog_post:blog-21#3` and `pin:blog-22#13`. That looks like a swap during
   data entry. **Do not resolve it by guessing** — it needs Racquel's eye on
   which graphic belongs to which post.
2. **A rejected row is already live.** `blog-21#1` has `status='rejected'` and
   `generated_asset_url='/images/home-inventory-apps-3-types-comparison.webp'`.
   Its `asset_file` is `three-kinds-of-home-inventory.jpg` — which is queue
   item 5, the regeneration Racquel wants. A rejected prompt is serving an
   image on a live page right now.
3. **`asset_file` has mixed provenance.** Most are the ~32-char truncated
   generator exports, but `blog-11#1` carries
   `SOP-072_Pantry_Organizing_Session.webp` — a real Drive filename, different
   convention, already `.webp`. **The computed transform will not match every
   row.** Expect to fall back to the real filename for some.

Also: the olive-oil webp **is** served at
`/public/images/stop-buying-olive-oil-pantry-inventory-duplicate.webp`, but
**no row points at it**. The row naming it in `asset_file` (`blog-22#1`) points
at the iceberg graphic instead. Served, unmapped, and mislabelled — all three.

---

## 5b. The files are on disk, but INSIDE ZIPS (verified 6 Aug)

**There is no extracted asset folder.** `C:\Users\rockl\Downloads\` root holds
2,883 loose images and only **9 of the 42** names resolve there. Do not scan
the root and conclude the files are missing — that is a 20-minute dead end.

Matching all 42 `asset_file` values against loose files **and every zip**:
**34 of 42 resolve.** The sources that matter:

| Archive | Holds |
|---|---|
| `sort-place-pins.zip` | **All 31 pins, already named exactly as `asset_file`.** 37 entries under `pins/`. **No transform needed** — the names match the table verbatim. |
| `sop-missing-photos-31-FINAL.zip` | The `SOP-*.webp` set, SOP-069 through SOP-120, plus `00_MANIFEST.csv`. |
| `download (20).zip` | The generator export, 5 Aug — the most complete of the `download (nn)` series. Names are `Title_Case_Truncated…_YYYYMMDDHHMM.jpeg`. |

**Prefer `sort-place-pins.zip`.** The `download (nn)` zips overlap heavily —
several names appear in four or five of them at different timestamps, so
picking from those means choosing a version. The pins zip does not have that
problem.

**The transform, confirmed:** real name → drop extension → drop trailing
`_YYYYMMDDHHMM` → drop the trailing `…` (a literal U+2026 the generator inserts
when it truncates at 32 chars) → lowercase → `_` becomes `-`.

**Eight did not resolve by name. Five are really only three:**

- `SOP-074_Storage_Closet_Organizing.webp` → the zip has
  `SOP-074_Storage_Closet_Organizing_Session.webp`
- `SOP-114_Drawer_Interior_Reset.webp` → the zip has
  `SOP-114_Drawer_or_Shelf_Interior_Reset.webp`

  Both are safe: **the SOP number is a unique key.** Match on it, not the words.
- **Genuinely absent: `SOP-052_Freezer_Organization_Audit.webp`,
  `SOP-053_Pantry_Audit_Method.webp`, `SOP-126_Shabbos_Table_Setting.webp`.**
  The archive covers 069–120 only, so 052, 053 and 126 fall outside it.
- **`blog-40-morning-counter.jpg`, `blog-40-snack-zone.jpg`,
  `blog-40-weekly-plan-board.jpg`** are on no disk and in no zip. Storage has
  exactly one blog-40 object, `marketing/blog/blog-40-inline-snack-drawer.jpg`.
  **These three are for the post that publishes Tuesday.** Raise them early.

**`universal-housekeeping-sop-template.jpg` is NOT absent.** It is in four
places, including loose in Downloads as
`Universal_Housekeeping_SOP_Template_202608050829.jpeg`. Any note calling it the
one missing file is out of date.

**One ambiguity to flag, not guess.** `sort-place-pins.zip` contains both
`infographic-sheet-watercolor-flo.jpg` and `infographic-sheet-with-watercolo.jpg`.
`content_prompts` references only the first, on *both* `blog_post:blog-16#2` and
`pin:blog-16#22`. One of those two rows probably wants the `-with-` variant.
The zip also carries `reset-day-how-your-home-2/-3/-4.jpg`,
`training-staff-4-steps-2.jpg` and `pantry-bin-labeling-map-restock.jpg`, none
of which any row references — 37 entries against 31 pin rows.

---

## 6. Queue, in Racquel's order

1. **Filename mapping** — **4 of 66 rows carry a URL; 30 approved blog rows and
   30 approved pins still need one.** Destination is settled; only the files
   themselves are blocked on §5. Sweep `/public/images/` first.
2. **Item 7: Add Property reads `property_templates`.** Two rows, observant and
   non-observant. Do **not** hardcode flags, do **not** clone Low (no recipes,
   no meal plan) or Lax (carries `operator_console`, which never travels).
   `bedrooms`/`bathrooms` are real columns; changing them must **recompute
   scope**, adding a room + its 11 tasks, archiving rather than deleting, never
   forcing re-onboarding. **Acceptance: provision from
   `non_observant_household` at 3 bedrooms and get exactly Henderson —
   22 rooms, 167 tasks, zero observance content. If it differs, the template is
   wrong, not Henderson.**
3. **Seven missing migration files**: 200-203, 205-207.
4. Category chips smaller / less rounded.
5. Regenerate `three-kinds-of-home-inventory` — Racquel's call, it is her asset.

**Hard date: blog-40 publishes Tuesday 11 Aug. Its low-stock section is done;
the post is NOT.** The section was rewritten again 6 Aug so it says what low is
measured against (the amount each item already carries) and so the third beat
describes the list gaining coverage rather than the reader learning. **Its FAQ
still promises thresholds, in two places, in both `body_markdown` and
`faq_jsonld`.** Fix both columns or the structured data ships the claim on its
own. Proposed replacements are in the 6 Aug session; they need Racquel's yes.

blog-40's section is the pattern: same length, same three beats, opposite
premise — counting is the whole input, the list builds itself, the first month
fills in the picture.

**Scope of the remaining claim, scanned live 6 Aug**, not the nine reported
earlier. Literal "threshold" appears in **7 posts** including blog-40, and only
**one is live**: `blog-22-why-every-home-needs-digital-inventory`, and there
only inside `faq_jsonld`. The drafts are blog-14, blog-24 (five hits, the
worst), blog-15, blog-30, blog-23. No post uses "par level", "reorder point",
"base stock" or "target level" anywhere. **That scan is literal-phrase only** —
a post can promise a threshold without the word, so the seven need reading, not
grepping, and the count may go up. **Scan `faq_jsonld` as well as
`body_markdown` every time.**

---

## 7. Still with Racquel, not with code

- **Rotate the Pinterest app secret.** It was pasted in a conversation. **This
  is the gate.** Once images land, it is the only thing standing between the
  work and 30 pins going live. Two minutes.
- Two-factor on the Facebook account.
- Pinterest OAuth run (browser login) + refresh token into Supabase secrets.
- Verify the console items behind the owner/manager gate (1, 4, 5, 6, 7, 10 of
  the deploy checklist) — they need her screenshot anyway.

---

## 8. Recent rulings worth not re-litigating

- **Henderson as built is the standard.** Bedroom count = numbered bedrooms,
  excludes the Master. 3 bedrooms = Master + Bedroom 1/2/3 = 22 rooms,
  167 tasks. Do not remove a bedroom.
- **Operator Console** is the page name (SS-700 reversed). "Task Center"
  survives as a search keyword only.
- **Prose and figures share ONE measure.** Nothing bleeds wider than the text.
  `bleed` renders at the same width as `stacked` by design.
- **No outbound links** except Sort + Place's own social profiles.
- **Rows not code.** `blog_rules`, `work_sections`, `printables`,
  `blog_categories`, `property_templates` all exist so a rule is a row. A
  hardcoded label is how four fictional printables reached a live page.
- **Never delete.** Supersede (R21). Applies to the register, proposals,
  design rules and unsubscribes.
- **Asset destinations are settled** (SS-758, SS-759): blog inline images to
  the repo as webp, pins to storage under `pins/`, headers stay in `marketing`.
  Reopen only if the reasoning changes, not because it looks re-decidable.
- **No low-stock thresholds.** The product notices what is low; the user counts
  and configures nothing. Any draft that offers a threshold, a target level or
  a reorder point is wrong on the feature, not just the wording.
