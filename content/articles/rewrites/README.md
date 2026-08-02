# Voice rewrites — prepared, NOT yet loaded

18 articles rewritten for voice and length (SS-521 / SS-508), received 2 Aug
across four drops. These files are the STAGING-READY versions: renamed to
their true slugs and with the internal NOTES blocks removed. The originals
as delivered are not kept here, because the two differences below are the
whole point.

## Load with

    python3 scripts/stage-blog-drop.py content/articles/rewrites
    # then run each staged-sql/stmt_*.sql

The UPSERT updates title, excerpt, body_markdown and faq_jsonld, and touches
NEITHER published_at NOR header_image_url — so the 4 live articles stay live
with their images and the 9 drafts stay drafts. All 13 slugs were verified
against blog_posts before staging: 13 matched, 0 would insert.

## Two traps these files already have fixed — do not reintroduce

1. **Filename IS the slug.** stage-blog-drop.py derives the slug from the
   filename, so `article-11-VOICE-FIXED.md` produced `blog-11-VOICE-FIXED`
   and would have INSERTED a new row rather than updating the real article,
   silently, on a live post. Files here are named for their true slugs.

2. **NOTES blocks land in the published body.** The script cuts the body at
   `**Meta Description:**`, and the delivered files place `**NOTES —` BEFORE
   that line, so the internal rationale table was inside body_markdown and
   would have rendered on the public page. Stripped here.

Neither failure is visible to a build or a typecheck. Both are silent.

## QA passed on all 13

visible FAQ count == faq_jsonld count · meta description present · zero
outbound links · zero inline images (the renderer does not support
`![alt](file.jpg)` and emits it as literal body text) · no byline or name.

## Still to come

None. All 14 received: Drops 2, 3, 4 complete, plus 11/16/21/22 (live) and
12 (Drop 5). Article 17 arrived with its NOTES placed AFTER the Meta
Description line and a comment saying why, so trap 2 is fixed at source
from that file onward.

## Filename convention matters (added with the 02/03/06/07 batch)

That batch arrived named `blog-NN-slug.md`. Two failures if used as-is:
stage-blog-drop.py globs `article-*.md`, so it would have found nothing and
exited; and its slug rule is `'blog-' + strip_leading('article-')`, so a
`blog-` prefixed file yields `blog-blog-NN-...`. Files here are all
`article-NN-slug.md`, which is the only name that produces a correct slug.

## Precedence against the full 31-article package

A complete 31-article package (files_40) also exists, with header images and
Pinterest pins. It is the ORIGINAL long copy for the slugs listed here --
e.g. article 11 is 4,335 words there against 1,347 here. THIS FOLDER WINS
for every slug it contains. The package supplies the other 13 articles and
its images and pins, which are uncontested.
