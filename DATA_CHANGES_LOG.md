# Production Data Change Log

Direct-SQL edits to **user data** that deliberately are **not** migrations.

## Why these aren't migrations

Migration files exist so a fresh environment can be rebuilt from scratch. That
only makes sense for schema and for *seeded reference content*. It does not make
sense for user data:

- A fresh environment has no `inventory_items` and no `recipes` at all — nothing
  seeds them (the `insert into inventory_items` occurrences in `074`, `095`,
  `100`, `101`, `112`, `113` are all inside RPC **function bodies**, not seed
  data). A migration that deleted 22 rows by id would match nothing.
- Worse, a delete-by-id migration is actively unsafe to keep in the sequence: if
  ids ever collide in another environment it would delete the wrong rows.

So user-data edits are recorded here instead, with enough detail to audit or
reverse them. Reference content (`help_articles`) *is* migration-appropriate and
lives in `supabase/migrations/126_help_articles_content_reconciliation.sql`.

---

## 2026-07-26

### `recipes` — "Slow Cooked French Roast" cleanup

- `notes` set to `null` (it was a verbatim duplicate of `instructions_en`).
- AI artifact sentence "Compiled from the recipe images you provided" stripped
  from `instructions_en` and `instructions_es`.

Verified after the fact: `notes is null` for that recipe, and **0 rows** anywhere
in `recipes` still contain the artifact string in either language.

### `inventory_items` — deduplication and one rename

- 22 duplicate rows deleted (1,602 → 1,580). Verified live count: **1,580**.
- "Jalapeño" renamed to "Jalapeño Pepper", `name_es` set to "Chile Jalapeño".

> [!WARNING]
> **Never write a rule-based dedupe for this table.** The matching key must
> retain digits. A digit-stripping normalization merges genuinely different
> products:
>
> - "Portion Cups 1 oz" vs "Portion Cups 4 oz"
> - "8x8 Square Pan" vs "9x9 Square Pan"
>
> Work only from a reviewed list of explicit ids. This is the same class of
> failure as the earlier kashrut bug, where kosher type was guessed from a
> recipe's *name* by substring match and "Butternut Squash and Apple Soup"
> (really Parve) matched "butter".

### Related, not user data

`help_articles` Spanish backfill (44 rows) and the FAQ-040 English correction
were reconciled as a real migration — see
`supabase/migrations/126_help_articles_content_reconciliation.sql`.
