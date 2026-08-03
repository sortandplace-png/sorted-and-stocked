# Blog header namespaces — SS-542

Two unrelated article series both number from 01. They used to collide,
separated only by `.jpeg` vs `.jpg`, which is not a convention anything
enforced. Six of seven files in one drop would have landed on the wrong
article. The namespace is now STRUCTURAL:

    legacy-NN-header.jpg   the 7 original posts (blog-01..07-*, all LIVE)
    blog-NN-header.jpg     the 31-article SEO package

The series is now readable from the filename. Never reintroduce a bare
`blog-NN-header.jpeg`.

## Load order — deviating from it breaks live pages

`header_image_url` must be repointed LAST, after the file exists in storage:

1. commit files here as `legacy-NN-header.jpg`
2. deploy, and wait for production to actually serve them (~5 min after
   merge; the ingest fetches from production and a too-early run 404s
   while still reporting status "done" — check returned byte counts, not
   job status)
3. run the fetch-url ingest into `marketing/blog/`
4. ONLY THEN update `blog_posts.header_image_url` for the 7 legacy posts

Doing step 4 before step 3 points seven live posts at files that do not
exist yet.


## blog-03-training-header.jpg (3 Aug)

The replacement header for blog-03-training-household-staff (SS-566: its
previous two headers were both internal SOP imagery). A kitchen photograph,
1672x941, converted from Racquel's png delivery at q88. READ AT FULL SIZE
before staging: no text anywhere in frame, no labels, no wordmark; the
soft-focus shelving does not resolve to characters at any magnification.

Deliberately named OUTSIDE both colliding namespaces (not blog-03-header.*,
which exists as BOTH .jpeg legacy and .jpg package). Ingest to
marketing/blog/blog-03-training-header.jpg after deploy; the
header_image_url write is chat-side, not Code's.
