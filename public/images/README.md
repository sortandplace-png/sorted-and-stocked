# Blog inline graphics — SS-580

Served at `/images/<file>`. Each graphic ships as a `.webp` + `.png` pair
with identical basenames: the renderer emits `<picture>` with the webp
source and the png fallback, so BOTH must exist or non-webp clients get a
broken image (preflight-blog.py warns on a missing sibling).

Present (content-read at full size before placing, per SS-560/SS-566):

    household-management-system-4-components   1920x1280  blog-16
    home-inventory-apps-3-types-comparison     1920x1280  blog-21
    hidden-costs-no-home-inventory-iceberg     1344x1792  blog-22
    stop-buying-olive-oil-pantry-inventory-duplicate  1408x1760  (unassigned)

DELIBERATELY ABSENT: pantry-organization-reach-hierarchy-pyramid (blog-11).
The delivered render carries a generation-prompt leak as its footer
("Sort + Place with plus sign"), mislabels the waist-to-eye tier LOW where
the article's hierarchy says GOOD, and has a "long-ang-term" typo plus
duplicated tier labels. Needs a re-render; do not place or reference the
delivered file.
