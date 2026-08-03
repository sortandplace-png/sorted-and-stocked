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

    pantry-organization-reach-hierarchy-pyramid       1920x1280  blog-11

The pyramid is the 3 Aug RE-RENDER, read at full size before placing: the
prompt-leak footer is gone (reads "Sort + Place"), waist-to-eye is GOOD
with a single LOW tier, no typo. Its .png sibling was generated FROM THIS
RENDER -- the original zip's png is the DEFECTIVE first render, and using
it as the <picture> fallback would serve the prompt-leak version to every
client that cannot decode webp. Never restore that file.
