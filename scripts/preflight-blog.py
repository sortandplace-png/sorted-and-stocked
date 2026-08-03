#!/usr/bin/env python3
"""
preflight-blog.py -- validate article .md files BEFORE stage-blog-drop.py runs.

WHY THIS EXISTS (SS-557). Five packaging traps have hit this pipeline, every
one found by a person rather than a check, and every one silent: no build
error, no typecheck failure, no visible symptom until a wrong page was live.

  1. FILENAME IS THE SLUG   article-NN-VOICE-FIXED.md -> public slug
                            blog-NN-VOICE-FIXED, INSERTED as a new row rather
                            than updating the real article
  2. blog- PREFIXED FILE    the staging glob only matches article-*.md, so a
                            blog- prefixed file is skipped in silence
  3. NOTES BEFORE META      stage-blog-drop.py cuts the body at
                            "**Meta Description:**", so notes placed above it
                            ship as published copy
  4. SCHEMA AS A SIDECAR    FAQ JSON-LD as a separate .json file; the script
                            exits, and the temptation is a hand-written
                            UPDATE, which is how every one of these started
  5. FAQ DRIFT              rendered ### questions disagreeing with JSON-LD
                            mainEntity, which Google treats as a
                            structured-data violation: worse than no schema

Plus the standing content rules: no outbound links (SS-506), images only
from allowed sources (site-relative or this project's public storage -- the
renderer gained image support 3 Aug and silently drops anything else, so a
disallowed src is invisible content loss, not a rendering error), no
personal byline, and no retired ampersand wordmark in any form -- literal,
URL-encoded or HTML-entity (SS-556, where %26 survived three sweeps).

ERRORS block (exit 1). WARNINGS are informational and do not block: the em
dash count is a warning until Racquel rules on whether SS-491 covers the blog,
and it fires on all 31 files until then.

    python3 scripts/preflight-blog.py content/articles/rewrites
    python3 scripts/preflight-blog.py content/articles/rewrites/article-01-foo.md
"""

import json
import pathlib
import re
import sys

META = '**Meta Description:**'
# article-[NN-]lowercase-slug.md. NN is optional: four of the 31 carry no
# number and all four staged correctly, so a missing number is a consistency
# note, not a failure (SS-557, and SS-553 -- the rule was too strict, not the
# files wrong).
SLUG_RE = re.compile(r'^article-(?:(\d{2})-)?([a-z0-9-]+)\.md$')
FENCE_RE = re.compile(r'```json\s*(\{.*?\})\s*```', re.S)
H3_RE = re.compile(r'^### (.+?)\s*$', re.M)
# Lookbehind so ![alt](src) does not ALSO match as a link -- before the
# renderer had image support that double-match was harmless (both were
# errors); now an allowed image must not trip the internal-link rule.
LINK_RE = re.compile(r'(?<!!)\[([^\]]+)\]\(([^)]+)\)')
IMG_RE = re.compile(r'!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
STORAGE_PUBLIC_PREFIX = 'https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public/'
NAME_RE = re.compile(r'racquel|about the author', re.I)
WORKING_TITLE_RE = re.compile(r'voice|fixed|template|rewrite|final|copy|-v\d+', re.I)
# SS-556: an audit for a literal must also search its encoded forms.
AMPERSAND_FORMS = ['&', '%26', '&amp;', r'&', '&']
# ONLY the company name is affected. "Sort & Place" is retired; the correct
# form is "Sort + Place".
#
# "Sorted & Stocked" is NOT retired and must never be swept (Racquel, 3 Aug).
# It is the APP's real name and its ampersand is correct. This list briefly
# contained it, which would have made every article that legitimately names
# the product fail a blocking check -- the gate itself manufacturing the
# error it exists to catch. Two different names, one shared word, opposite
# rules: read the name before assuming the ampersand is the bug.
RETIRED_MARKS = ['Sort {} Place']
ALLOWED_INTERNAL = {'/welcome', '/contact'}


def check(path: pathlib.Path) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for one article file."""
    errors: list[str] = []
    warnings: list[str] = []
    name = path.name
    text = path.read_text(encoding='utf-8')

    # --- Trap 1: the filename becomes the public slug, verbatim -------------
    m = SLUG_RE.match(name)
    if not m:
        errors.append(
            f"filename '{name}' does not match article-[NN-]lowercase-slug.md; "
            'the staging script derives the slug from it, so this ships a junk URL'
        )
    else:
        if m.group(1) is None:
            warnings.append(
                'filename carries no NN number, so the slug has no sequence '
                'position (4 of the 31 are like this and staged fine)'
            )
        slug = m.group(2)
        if WORKING_TITLE_RE.search(slug):
            errors.append(
                f"slug '{slug}' contains a working-title marker, and it ships as the public URL"
            )

    if not text.startswith('# '):
        errors.append('no H1 on the first line, so the post has no title to stage')

    # --- Trap 3: NOTES must sit AFTER the meta line, or they publish --------
    meta_at = text.find(META)
    if meta_at == -1:
        errors.append(f'no "{META}" line; the staging script exits and the body is never cut')
    notes_at = text.find('**NOTES')
    if notes_at != -1 and meta_at != -1 and notes_at < meta_at:
        errors.append('NOTES block sits BEFORE the meta line, so it lands in the published body')

    # --- Trap 4: schema must be fenced in this file, not a sidecar ----------
    fences = FENCE_RE.findall(text)
    faq_json = None
    if not fences:
        sidecar = list(path.parent.glob(f'{path.stem}*.json')) or list(path.parent.glob('*faq*.json'))
        hint = f' (sidecar found: {sidecar[0].name}; inline it)' if sidecar else ''
        errors.append(f'no fenced ```json FAQPage block{hint}')
    else:
        try:
            faq_json = json.loads(fences[0])
        except json.JSONDecodeError as e:
            errors.append(f'fenced JSON does not parse: {e}')
        else:
            if faq_json.get('@type') != 'FAQPage':
                errors.append(f"fenced JSON @type is {faq_json.get('@type')!r}, expected FAQPage")
                faq_json = None

    # Everything below judges the PUBLISHED body only, the part before the
    # meta line. Grepping the whole file produces false positives on the NOTES
    # section, and chasing those is itself one of the documented traps: people
    # "fix" copy that was never going to ship.
    body = text[:meta_at] if meta_at != -1 else text

    # --- Trap 5: rendered questions vs schema questions --------------------
    faq_block = re.search(r'^## Frequently Asked Questions\n(.*?)(?=^```json|\Z)', body, re.S | re.M)
    rendered = [h.strip() for h in H3_RE.findall(faq_block.group(1))] if faq_block else []
    if faq_json is not None:
        schema_qs = [q.get('name', '').strip() for q in faq_json.get('mainEntity', [])]
        if not rendered:
            errors.append('no "## Frequently Asked Questions" section with ### questions in the body')
        elif schema_qs != rendered:
            errors.append(f'FAQ drift: {len(rendered)} rendered vs {len(schema_qs)} in JSON-LD')
            for q in schema_qs:
                if q not in rendered:
                    errors.append(f'    in schema, not on page: {q}')
            for q in rendered:
                if q not in schema_qs:
                    errors.append(f'    on page, not in schema: {q}')

    # --- Standing content rules --------------------------------------------
    for alt, src in IMG_RE.findall(body):
        # Mirrors lib/simple-markdown.tsx isAllowedImageSrc exactly. A src
        # outside the allowlist renders as NOTHING, so shipping one is
        # silent content loss -- block it here where it is visible.
        if not (src.startswith('/') or src.startswith(STORAGE_PUBLIC_PREFIX)):
            errors.append(f'image src outside site/storage (renders as nothing): {src[:70]}')

    for label, target in LINK_RE.findall(body):
        if target.startswith('http'):
            errors.append(f'outbound link (SS-506, none allowed): [{label[:30]}]({target[:48]})')
        elif target.startswith('/') and target not in ALLOWED_INTERNAL:
            errors.append(f'internal link outside /welcome and /contact: {target}')

    if NAME_RE.search(body):
        errors.append('personal name or byline in the published body; the byline is "Sort + Place"')

    for mark in RETIRED_MARKS:
        for amp in AMPERSAND_FORMS:
            if mark.format(amp) in text:
                errors.append(f'retired ampersand wordmark present: {mark.format(amp)!r}')

    dashes = body.count('—')
    if dashes:
        warnings.append(f'{dashes} em dash(es) in body; SS-491 covers marketing copy, blog unruled')

    return errors, warnings


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1

    target = pathlib.Path(sys.argv[1])
    if target.is_dir():
        files = sorted(target.glob('article-*.md'))
        # Trap 2 can only be caught HERE. A file named blog-NN-slug.md is
        # never matched by the article-*.md glob, so a per-file rule that
        # inspects an already-globbed name can never fire on it -- the check
        # has to look for the files the glob does not see.
        strays = sorted(target.glob('blog-*.md'))
    else:
        files, strays = [target], []

    if not files and not strays:
        print(f'no article-*.md files found in {target}')
        return 1

    total_err = 0
    for s in strays:
        print(f'\n{s.name}\n  FAIL  blog- prefixed: the staging glob never sees this file at all')
        total_err += 1

    for f in files:
        errors, warnings = check(f)
        if errors or warnings:
            print(f'\n{f.name}')
            for e in errors:
                print(f'  FAIL  {e}')
            for w in warnings:
                print(f'  warn  {w}')
        total_err += len(errors)

    print(f'\n{len(files) + len(strays)} file(s) checked, {total_err} blocking error(s)')
    return 1 if total_err else 0


if __name__ == '__main__':
    sys.exit(main())
