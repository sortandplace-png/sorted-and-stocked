#!/usr/bin/env python3
# scripts/stage-blog-drop.py
# The repeatable half of the fortnightly blog cadence (SS-500, 2 Aug):
# three posts per drop, every other week, from the 25-article SEO package.
#
# Input: a directory of article-NN-<slug>.md files in the package format
# (H1 title, body markdown, one ```json fenced FAQPage block, then the
# production-notes tail starting at "**Meta Description:**").
#
# Output: one stmt_NN.sql per article -- an UPSERT that stages the post as
# a DRAFT (published_at NULL). Run each against the database, then run the
# LINK PASS and set header_image_url + published_at per the drop checklist
# below. Nothing this script emits publishes anything.
#
# Drop checklist (what tonight's first drop did, in order):
#   1. python3 scripts/stage-blog-drop.py <dir-of-articles>
#   2. Run each stmt_*.sql (drafts land invisible).
#   3. Featured images: 1376x768 JPEGs named blog-NN-header.jpg into
#      public/blog-headers/ (commit + deploy), then a 'fetch-url' ingest
#      job copies them to storage marketing/blog/ and header_image_url is
#      set to the public storage URL (same convention as the live posts).
#   4. LINK PASS before publishing: waitlist/Sorted & Stocked links ->
#      /welcome, consultation/booking -> /contact, all other cluster links
#      stripped to plain prose. No live href may 404.
#   5. Citations: any flagged claim needs a real linked source or the post
#      holds.
#   6. Publish: update blog_posts set published_at = now() where slug = ...
#      (revert is published_at = NULL). Reconcile the SQL into migration
#      history.
import json
import pathlib
import re
import sys

def stage(path: pathlib.Path, out_dir: pathlib.Path, n: int) -> str:
    text = path.read_text(encoding='utf-8')
    m = re.match(r'# (.+)\n', text)
    if not m:
        raise SystemExit(f'{path.name}: no H1 title')
    title, rest = m.group(1).strip(), text[m.end():]

    fence = re.search(r'```json\n(.*?)\n```\n?', rest, re.S)
    if not fence:
        raise SystemExit(f'{path.name}: no fenced FAQPage JSON block')
    faq = json.loads(fence.group(1))
    rest = rest[:fence.start()] + rest[fence.end():]

    meta = re.search(r'\*\*Meta Description:\*\*\s*(.+)', rest)
    if not meta:
        raise SystemExit(f'{path.name}: no Meta Description line')
    excerpt = re.sub(r'\s*\(\d+ characters\)\s*$', '', meta.group(1).strip())
    body = re.sub(r'(\n---\s*)+\Z', '\n', rest[:meta.start()].rstrip() + '\n').strip()

    slug = 'blog-' + re.sub(r'^article-', '', path.stem)
    for token in ('$md$', '$t$', '$x$', '$faq$'):
        if token in body or token in title or token in excerpt:
            raise SystemExit(f'{path.name}: dollar-quote token collision')
    faq_s = json.dumps(faq, ensure_ascii=False)

    sql = (
        "insert into blog_posts (slug, title, excerpt, body_markdown, header_image_url, cta_label, cta_url, published_at, faq_jsonld)\n"
        f"values ('{slug}', $t${title}$t$, $x${excerpt}$x$, $md${body}$md$, null, 'Book Your Consultation', '/contact', null, $faq${faq_s}$faq$::jsonb)\n"
        "on conflict (slug) do update set title = excluded.title, excerpt = excluded.excerpt, body_markdown = excluded.body_markdown, faq_jsonld = excluded.faq_jsonld, updated_at = now()\n"
        "returning slug, (published_at is null) as is_draft;"
    )
    out = out_dir / f'stmt_{n}.sql'
    out.write_text(sql, encoding='utf-8')
    return slug

def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: stage-blog-drop.py <dir with article-*.md>')
    src = pathlib.Path(sys.argv[1])
    files = sorted(src.glob('article-*.md'))
    if not files:
        raise SystemExit(f'no article-*.md in {src}')
    out_dir = src / 'staged-sql'
    out_dir.mkdir(exist_ok=True)
    for n, f in enumerate(files, start=1):
        slug = stage(f, out_dir, n)
        print(f'stmt_{n}.sql  ->  {slug}  (draft)')
    print(f'{len(files)} article(s) staged as SQL in {out_dir}/ -- drafts only; see the drop checklist in this file.')

if __name__ == '__main__':
    main()
