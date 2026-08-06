# Directions for the next session

Written 6 Aug 2026 at the end of a long session, for whoever picks this up.
Read this before touching anything. Most of it is things that cost real time
to learn.

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
- "`content_prompts.asset_file` doesn't resolve" — **there is no `asset_file`
  column**. The filenames were never in the table.
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

**Two corrections before uploading:**
1. `olive-oil-bottle-stop-buying.jpg` is **already in the repo** at
   `/public/images/stop-buying-olive-oil-pantry-inventory-duplicate.webp`.
   Check the manifest for others already served before downloading.
2. Blog inline images are served from **`/public/images/`**, not a bucket. The
   11 live posts use that path. Decide where the 32 live *before* uploading, or
   blog images end up split across two homes.

---

## 6. Queue, in Racquel's order

1. **Filename mapping** — 4 of 35 resolved, 31 flagged `NO FILE`. Blocked on §5.
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

**Hard date: blog-40 publishes Tuesday 11 Aug and still has the low-stock
threshold section. Images do not fix that. It is the only dated item.**

---

## 7. Still with Racquel, not with code

- **Rotate the Pinterest app secret.** It was pasted in a conversation.
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
