# Lead-magnet PDFs — SS-567

Files here are served publicly at `/downloads/<name>.pdf` and are linked
from `blog_posts.body_markdown` on 24 posts.

## Filenames are load-bearing

The markdown links are already written in the database and point at exact
filenames. A file whose name differs by one character is a dead link with
no build error and no typecheck failure — the same shape as the five
staging traps in `scripts/preflight-blog.py`. Place files under **exactly**
the delivered names; never "tidy" one.

Currently linked from LIVE posts, so these three must exist:

    pantry-organization-checklist.pdf     blog-11-pantry-organization-ideas
    household-systems-planner.pdf         blog-16-what-is-a-household-management-system
    home-inventory-starter-guide.pdf      blog-22-why-every-home-needs-digital-inventory

## Two things are required, not one

Placing the files is necessary but was NOT sufficient. Until 3 Aug this
directory was matched by `middleware.ts`, which 307s anything non-public to
`/login`. The matcher's exclusion list covers image extensions only, so
`.pdf` was never exempt and `/downloads` was not in `PUBLIC_PATHS`. Every
one of these URLs returned the **sign-in page with status 200** — not a
404, which is why nothing flagged it.

`downloads/` is now excluded in the middleware matcher. If these links ever
start serving HTML again, check that exclusion first.

## Verifying

A missing file must return **404**. If it returns 200 with an HTML body,
middleware is intercepting again and no amount of re-uploading will help.

    curl -sI https://www.sortandplace.com/downloads/<name>.pdf
