# Voice rewrites — prepared, NOT yet loaded

13 articles rewritten for voice and length (SS-521 / SS-508), received 2 Aug
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

## Not yet received

Article 17 (Drop 3). Drop 3 is otherwise complete (20 + maintenance tracker).
