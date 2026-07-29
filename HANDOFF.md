# Handoff — 29 July 2026

Written after the blog-markdown session, for whoever picks this up next. Read
`work_items` and `design_rules` in Supabase first — see "The work_items
register" below before you write to either.

---

## State

- `main` at **`99fa365`** (SS-347). Nothing from tonight's session is
  committed yet as of this writing — see "What was done tonight" below for
  what's about to land.
- Repo location: **`C:\dev\sorted-and-stocked`**. A second, older clone of
  the same repo (same remote, same `99fa365` HEAD) still exists at
  `C:\Users\rockl\OneDrive\Desktop\Sort and Place\sorted-and-stocked-files`
  — that's the pre-move checkout and was *not* deleted when the repo moved.
  It is stale the moment either copy gets a new commit. See the trap below;
  don't edit or preview against it.
- QA test account: recreated tonight, see `DEV_NOTES.local.md` for current
  credentials. The previous one documented there was already gone (deleted,
  not just expired) — expect to recreate it again next time unless someone
  starts leaving it alone.

### Local dev server

`npm run dev` (port 3000, plain `.next`) and `npm run dev:agent` (port 3100,
`.next-agent`) are separate builds. If a preview tool defaults to launching
`dev` from the wrong working directory (see the OneDrive-clone trap), you'll
get a server that compiles successfully and returns 200s while silently
serving old code — it won't error, it'll just be wrong. Confirm which
checkout a running server actually started in before trusting what it
renders.

---

## What was done tonight

**The actual bug, once the premise was corrected:** the *public* blog
(`app/blog/[slug]/page.tsx`) already rendered `##`/`**` correctly via
`lib/simple-markdown.tsx` — that page was never broken. The real bug was on
the **internal, authenticated** `/properties/[id]/blog/[slug]` view:
`components/BlogPostDetail.tsx` did `content.split('\n')` on
`body_markdown`, showing raw markdown syntax to logged-in staff, and its
`generateMetadata` returned the same static title for all 7 posts.

Fixed:
- `BlogPostDetail.tsx` now renders `body_markdown` with `react-markdown`
  (added to `package.json`), styled `font-display` (Cormorant Garamond) for
  headings and `font-interDisplay` (Inter) for body text — both already
  loaded app-wide in `app/layout.tsx`, just not previously mapped to this
  component. The leading `# <title>` line in `body_markdown` is stripped
  before rendering since the title already renders separately above it.
- `generateMetadata` in `app/properties/[id]/blog/[slug]/page.tsx` now
  fetches the post and returns its real title/excerpt instead of a shared
  static string.
- `ctaLabel`/`ctaUrl` props were **kept**, not dropped — `cta_label` and
  `cta_url` are real, populated columns on all 7 `blog_posts` rows, even
  though no migration file adds them (see SS-358 below).
- Verified in-browser against a real post (`blog-01-household-management-mistakes`)
  on the correct `C:\dev\sorted-and-stocked` checkout, port 3100.

**Not touched, deliberately:** the public `/blog` page, `simple-markdown.tsx`,
and `C:\dev\stale-checkout-2026-07-23.patch` (see traps — do not apply that
patch; it targets a schema and file layout that no longer exist and would
have overwritten `supabase/migrations/082_add_blog_header_images.sql` with
unrelated, older content).

---

## The work_items register — how it actually works

`work_items` (and `design_rules`) live in Supabase, project
`jfaaqzrezcrkkidlsbwj`. **Multiple things write to `work_items`, in real
time, concurrently:**

- **Racquel** runs a parallel Claude chat with its own Supabase connection.
  Standing arrangement: whichever Claude Code session is doing the work
  (`owner = 'code'`) logs findings as they're made — including things that
  turn out to be *wrong premises*, not just confirmed bugs (SS-352/353/354
  from tonight are examples: correcting the original bug report, refusing a
  stale patch, and correcting a claim about dead columns).
- The **other Claude session** (`owner = 'claude'`) verifies claims against
  live data and is the one that sets a row to `resolved` — `code` proposes,
  `claude` (or Racquel, `owner = 'rav'`) closes. A `resolved` row is
  DB-constrained to need `verified_at` and `verified_how` set — you
  physically cannot mark your own row resolved without that.
- `owner` is constrained to `racquel | code | claude | rav`. `evidence` is
  constrained to `verified_live | schema_confirmed | claimed | inference` —
  it's a category, not a free-text field (`detail` is where the narrative
  goes). `status` is `open | partial | resolved | superseded | parked`.
- IDs are **not** exclusively yours to sequence — another session can claim
  the next `SS-NNN` between your `select max(id)` and your `insert`. Compute
  the next id and insert in one statement (see the tonight's commit for the
  pattern), and be ready to retry once on a primary-key collision.

**Tonight's confusion, for the record:** a fresh session (no memory of any
of this) queried `work_items` mid-task, saw rows dated to the same minute
describing its own just-reached conclusions, and correctly treated that as
an anomaly worth stopping for rather than assuming — untrusted-looking data
that turns out to be legitimate is still worth pausing on until it's
verified, and it was verified here by cross-checking auth.users/properties
directly rather than trusting the register's own narrative. That's the
right instinct; it just didn't have this paragraph to read first. Now it
does.

---

## Traps that cost real time tonight

- **A second, un-deleted clone of this repo exists.** See "State" above.
  Editing one checkout and previewing the other produces a dev server that
  compiles cleanly and serves 200s while rendering old code — no error
  anywhere. If a change doesn't show up after a clean edit and a fresh
  compile log, check *which directory the server actually started in*
  before doubting the edit.
- **`DEV_NOTES.local.md` credentials can go stale silently.** The documented
  QA account no longer existed in `auth.users` — not expired, just gone.
  Login failed with a generic "Invalid login credentials," which looks
  identical to a typo'd password. If a documented dev account fails to log
  in, check whether the account still exists before assuming the password
  is wrong.
- **Test accounts must be scoped to a demo property and removed the same
  turn they're created for.** Two were found live with `manager` on **Main**
  — Racquel's real household — tonight: one from this session, one left over
  from earlier today (`demo@sortedandstocked.com`). Both were removed.
  Going forward: create against a demo property, never Main, and delete
  before ending the turn that needed them.
- **A patch file's own filename can be the warning.** `stale-checkout-2026-07-23.patch`
  named its own staleness. It targeted a `blog_posts` schema
  (`property_id`, `content`, `header_image_alt`) that no longer exists, and
  its migration file would have silently overwritten a real, differently-
  numbered migration already on `main`. Check a patch's assumed schema
  against the live one before applying anything from it.
- **A stale handoff file is worse than none** — the version of this file
  dated 28 July described a `main` at a commit (`f0135f3`) and a set of
  tickets (Rosh Chodesh, staff handbook, sop-posters) that don't exist in
  this repo's actual history. It was overwritten rather than trusted.

---

## Open, from the previous state of this repo

Not re-verified tonight — carried forward only because nothing in tonight's
session touched this area. Confirm against `work_items` before acting on it,
per the section above.

- **SS-358** — `blog_posts.cta_label` / `cta_url` have no migration file.
  Columns are live and populated; schema history doesn't account for them.
  Needs a migration written to match live schema, or documented as a
  dashboard-applied change.

---

## Standing rules

`design_rules` (24 rows, Supabase) is authoritative for visual/UX rules —
not reproduced here. Query it rather than relying on a summary that will go
stale the way this file's predecessor did.
