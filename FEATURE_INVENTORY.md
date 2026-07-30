# Sorted & Stocked — Feature Inventory

Enumeration of every route, page title, user-facing control, what it does, and which role can see/use it. Generated 2026-07-30 by reading the route/component source directly. Role shorthand: **all** = owner/manager/staff, **owner+manager** = manager gate, **owner only** = stricter gate. Where a whole page is gated, that's called out once at the top of the section instead of repeated per control. Some pages have **no role gate in the code at all** even though their nav entry is hidden from staff — those are flagged explicitly; they're reachable by any member who has the URL.

---

## Part 1 — Property-scoped routes (`/properties/[id]/...`)

### /properties/[id]/dashboard
**Page title:** No dedicated `<h1>` — desktop nav tab reads "Dashboard"; first on-page card header reads "Today."
**Controls:**
- Today card collapse/expand (pin dot) — all
- "Use my current location for candle lighting" (map-pin icon) — swaps household candle time for a geolocation-based one; toggles back on second tap — all
- Candle Lighting card collapse/expand (pin dot) — all
- Quick Add card collapse/expand (pin dot) — all
- "Take a Photo" tile — links to `/tools/quick-photo` — all
- "Scan a QR" tile — links to `/scan` — all
- "Add Product" tile — links to `/inventory?new=1` — all
- "Go to My Day" link — links to `/my-day` — staff only
- "View Brief" link (readiness strip) — links to `/shift-handover` — owner+manager only
- "Meal Plan" quick-action tile — links to `/meal-plan` — all (hidden if module_meal_plan off)
- "Recipes" quick-action tile — links to `/recipes` — all (module_recipes)
- "Add Recipe" quick-action tile — links to `/recipes` — all (module_recipes)
- "Shopping List" quick-action tile — links to `/shopping-list` — all (module_shopping)
- "Inventory" quick-action tile — links to `/inventory` — all (module_inventory)
- Pantry card (link + pin collapse toggle) — links to `/inventory?category=Pantry` — all (module_inventory)
- Meal Plan "This Week" card (link + pin collapse toggle) — links to `/meal-plan` — all (module_meal_plan)
- "Edit widgets"/"Done" toggle — enters/exits widget show/hide/reorder mode — all
- Move widget up/down (chevrons, edit mode) — reorders a widget — all
- Show/Hide widget (eye icon, edit mode) — toggles visibility, persisted per-user — all
- Today's Meal Plan card collapse/expand — all (module_meal_plan)
- Today's Meal Plan dish name links — to `/recipes/[recipeId]` — all
- "View full plan →" — links to `/meal-plan` — all
- Low Stock Alerts card collapse/expand — all (module_inventory)
- Low Stock item "mark purchased" checkbox — finds-or-creates a shopping list row and marks purchased — all
- Low Stock item row link — to `/inventory?item=[id]` — all
- Low Stock item Order button — opens preferred reorder link / Amazon search — all
- "View inventory →" / "+ Add item" — all
- Prep Ahead Assistant card collapse/expand — all (card hidden for staff when off)
- "Turn on"/"Turn off" (Prep Ahead) — flips `prep_ahead_assistant` flag — owner+manager
- Prep Ahead reminder recipe links — all
- "View all (N) →" — links to `/meal-plan` — all
- Shopping List summary card collapse/expand — all (module_shopping)
- Shopping List item "mark purchased" checkbox — all
- Shopping List item Order button — all
- "View list →" — links to `/shopping-list` — all
- Chametz Countdown card (whole card is a link) — links to `/inventory`; only in the 30-day pre-Pesach window — all
- "Tools" (mobile footer) — `/tools` — all (module_tools)
- "Staff" (mobile footer) — `/staff` — all (module_staff)
- "Photo Review" (mobile footer) — `/tools/photo-review` — owner+manager
- "Procurement" (mobile footer) — `/procurement` — owner+manager
- "Settings" / "Help" (mobile footer) — all
- Floating Scan button (desktop) — opens inventory QR/barcode ScanModal — all (module_inventory)

### /properties/[id]/inventory
**Page title:** Inventory
**Controls:**
- Back link — all
- Scan a label (camera icon) — opens `/scan` — all
- Batch scan multiple items — opens continuous multi-item QR scanner — all
- Print item labels — navigates to Print Labels tool — all
- + Add item — opens New Item form — all
- Low Stock / Never Counted / Expiring Soon stat tiles (toggle filters) — all
- Pesach Mode toggle — owner+manager
- Browse by Room / All Items tabs — all
- Search items input — all
- All categories dropdown, Running Low toggle (room mode) — all
- Active-filter chip remove / Clear all — all
- Floor tabs (All floors + per-floor) — all
- Category / Low Stock / Expiring Soon / Pesach Status filter pills (all-items mode) — all
- A–Z / By Store grouping toggle — all
- Letter-section collapse/expand — all
- Grouped product card expand/collapse + By Variety/By Location pivot — all
- Favorites tile, Low stock first toggle (room grid) — all
- Room/location card (tap) — all
- Room photo add/replace — owner+manager
- + Add room — opens New Room modal — all
- ← Rooms back, sub-location chip (single-room view) — all
- Favorite (star) toggle — all
- Quantity −/+ (long-press for bulk-add chips: +half case/+full case) — all
- Order/reorder link — all
- Item card (tap) → detail view — all
- Pull to refresh — all
- Item Detail: Back, Edit (owner+manager), per-location qty −/+, Print label link — mixed, noted per-control
- Add/Edit Item form: name, Spanish name (required), category, location, qty, min qty, unit, case size, store, price, reorder link, photo (take/choose/retake/crop/remove), scan (edit only), expiration date, opened date, print-label checkbox, notes, Cancel, Save, Delete (owner+manager)
- Photo Cropper: cancel, confirm, zoom, rotate, drag handles — all
- Camera Capture: close, shutter — all
- Duplicate Item Warning: update existing / add anyway / cancel — all
- Reorder Sources editor: set preferred (star), open link, edit, delete (owner+manager), add source, save/cancel — all
- Bracha section: category select, revert, save — all
- Restock Photo Prompt: take/library, skip, save — all
- Location Photo Upload (only reachable via owner+manager-gated camera icon): take/library, cancel, save — owner+manager
- New Room modal: name, cancel, save — all
- Batch Scanner: close, pause/resume, finish — all
- Inventory Ops Tools links: Pantry Zone Map, Borrowed & Lent, Duplicate Ingredients, Needs Linking — all

### /properties/[id]/recipes
**Page title:** Recipes
**Controls:**
- Scan a label — navigates to `/scan` — all
- + New Recipe — opens New Recipe modal — owner+manager
- Search box — all
- Clear filters — all
- Course / Dietary / Occasion / Prep filter pills (with live counts) — all
- "All" pill (desktop Prep row) — all
- Mobile filter accordion (staged picks) + Clear all + Apply Filters (N) — all
- "Use it up soon" window dropdown (3/4/5 days) — all
- "Use it up soon" / "Recently Added" recipe tiles — all
- Letter-group header collapse/expand — all
- Recipe card (click) — all
- Favorite (heart) toggle — all (per-user)
- Card "More actions" (kebab): Edit, Duplicate, Delete — owner+manager
- New/Edit Recipe modal: resume/discard draft, photo add/replace/remove, name, Spanish name (required), course, kosher type, servings, minutes, prep lead days, instructions, tags, equipment, Shabbos/Yom Tov/Pesach checkboxes, ingredient rows, + Add ingredient, Cancel, Save — owner+manager
- "Can't delete" dialog: choose replacement, repoint search, cancel/got it — owner+manager
- Delete confirmation: cancel, delete — owner+manager
- Floating kitchen timer button — all

### /properties/[id]/meal-plan
**Page title:** No on-screen `<h1>` (print-only "Meal Plan — {Month Year}")
**Controls:**
- Week / Month toggle — all
- Print (week/month) — all
- Share week (WhatsApp) — all (week view)
- Repeat next week → — owner+manager (week view)
- Generate shopping list — owner+manager (week view)
- Extend plan +4 weeks — owner+manager (week view)
- Go to shopping list → (post-generate) — owner+manager
- Day options → (Day Drawer) — all
- Meal slot "+ add" — owner+manager
- Change (pencil) / Remove (✕) per entry — owner+manager
- + Add another {course} (dip/salad) — owner+manager
- ← Prev / Today / Next → — all
- Day cell click (Month view) → Day Drawer — all
- Dish entry click (Month view) → Quick Edit Dish modal — all
- Duplicate Day / Print Day / Share Day (Day Drawer) — owner+manager
- Dish "•••" menu: View recipe, Change, Move to Another Day, Remove — owner+manager (View recipe also reachable by all via the dish name link)
- Add course buttons (Day Drawer) — owner+manager
- Quick Edit Dish modal: Change, Remove, View full day → — mixed (View full day: all)
- Swap-reason buttons / "Show me everything →" / Clear — owner+manager
- Kids Platter combo buttons (A–H) — owner+manager
- Pick a recipe / Quick entry toggle, kosher filter chips, search, list selection, quick-entry input — owner+manager
- Cancel / Save (Add/Edit meal modal) — owner+manager

### /properties/[id]/shopping-list
**Page title:** none — sticky tab bar ("Recipe Ingredients" / "Household Staples") is the page's top nav
**Controls:**
- Back link — all
- Tab switch (Recipe Ingredients / Household Staples) — all
- Pull-to-refresh — all
- Pairing-nudge "Add {item}" / dismiss (✕) — all
- Add-item text input + Add button (Recipe Ingredients tab) — all

### /properties/[id]/shopping-rules
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Page title:** Shopping Rules
**Controls:**
- Auto-restock toggle — writes `feature_flags.auto_restock` — owner+manager

### /properties/[id]/scan
**Page title:** Scan a label
**Controls:**
- QR/barcode live camera scanner — all
- Flashlight toggle — all
- Manual Search toggle + code input + Go — all
- New item name input + "Add as new item" (unmatched code) — all
- "Scan again" / "Try again" — all
- Reorder source pills / "Reorder" link — all
- Current quantity / Price inputs, Cancel, Save — all
- Post-save restock photo prompt — all

### /properties/[id]/bulk-photos
**Page title:** Bulk add photos
**Controls:**
- "Take photos" / "Choose from library" — all
- "+ Take more" / "Library" (once queued) — all
- Search input (match candidate) — all
- Item match button (per candidate, top 30) — all
- "Not a product photo — skip →" — all
- "Skip and continue →" (failed upload) — all
- "Take more photos" / "Library" (completion screen) — all
- Camera-capture modal — all

### /properties/[id]/batch-operations
**Page title:** Batch Operations
**No role gate found anywhere in the route** — reachable and functional for any property member. Also note: has its own manual Property ID text field, not derived from the route param.
**Controls:**
- Back link — all
- Property ID input (manual) — all
- Preview Changes (Dry Run) — previews shopping-link updates for up to 500 ingredients — all
- Apply Shopping Links — writes the updates (confirm dialog); disabled until a dry run has run — all
- Batch Fetch Photos — bulk-fetches photos for up to 100 ingredients (confirm dialog) — all

### /properties/[id]/print-labels
**Page title:** Print Item Labels
**No role gate found** — reachable and functional for any property member; the sitemap's manager-only listing is a nav-visibility convention only, not enforcement.
**Controls:**
- Search by name — all
- Location filter, Broad/Detailed toggle, Category filter — all
- "Only items with photos" / "Low stock only" checkboxes — all
- Label status filter pills (All/Unlabeled-New/Needs Update/Printed) — all
- Clear (filters) — all
- Label language toggle (English/Español) — all
- "Load N items flagged for printing" / Select all / Clear (items) — all
- Item row checkbox (per group) — all
- Selected-items chip panel toggle + per-chip ✕ — all
- Print 1 test sheet — all
- Generate PDF (N labels) — marks items label-printed via RPC — all
- Back link — all

### /properties/[id]/blog
**Page title:** Sorted & Stocked Blog
**Controls:**
- Back to Dashboard — all
- Blog post card → `/blog/[slug]` — all

### /properties/[id]/blog/[slug]
**Page title:** dynamic (the post's own title)
**Controls:**
- Print — `window.print()` — all
- Email — mailto: link — all
- WhatsApp — share link — all
- CTA button (conditional, from `cta_label`/`cta_url`) — all
- Back to Blog — all

### /properties/[id]/yom-tov
**Page title:** Yom Tov — the year ahead
**Controls:**
- Back link to `/meal-plan` — all
- Month-grouped list — read-only, no per-entry action — all

### /properties/[id]/sitemap
**Page title:** Sitemap
Every tile navigates somewhere; visibility of manager-only tiles is filtered server-side via a `MANAGER_ONLY_HREFS` allowlist. Full tile list (all navigate, role as noted): Dashboard, Recipes, Meal Plan, Shopping List, Inventory, My Day, Staff, Shift Handover, Reset for Next (all); Print Labels, Staff Task Center, Duty Roster, Task Verification, Duplicate Ingredients, Needs Linking, Capture Inbox, Guest & Family Taste Memory, Settings (owner+manager only, hidden from staff); Price Scanner, Ingredient Scanner, Recipe Scanner, Kitchen Timer, Scale Servings, Prep Timeline, Pantry Zone Map, Borrowed & Lent, Room Photo Review, House Manual, Contacts & Vendors, Local Takeout Directory, Blog & Articles, Scan, Bulk Photo Upload, Batch Operations, Yom Tov Year View (all).
**Note:** Suppliers and Full Backup tiles show for everyone on this page even though their destination pages are owner+manager/owner-gated — they're not in this page's own `MANAGER_ONLY_HREFS` list, a discrepancy from the code comment's claim.

### /properties/[id]/settings
**Page title:** Settings
**Controls:**
- Phone number input + "Text me updates" toggle + Save (Notifications) — all
- Guest & Family Taste Memory toggle (Household Features) — owner+manager
- Pay via Square button/link, Square payment link input, Save link, Email/Text channel selector, Send payment link (Client Billing & Invoicing) — owner+manager
- Generate invite code, Copy code, Copy link, Revoke (per code) (Invite Codes) — owner+manager
- Broadcast message textarea + Send broadcast — owner+manager
- Staff Slots Editor: Activate/Deactivate, Label (EN/ES) inputs, Save (per slot), Add slot — owner+manager

### /properties/[id]/help
**Page title:** "Help Center" (or "Staff Handbook" when arriving via `?category=Staff & Permissions`)
**Controls:**
- Back button (router.back()) — all
- Search input — all
- Category header collapse/expand — all
- Article card expand/collapse (deep-linkable via `?article=`) — all

### /properties/[id]/my-day
**Page title:** My Day
**Controls:**
- "Watch: My Day (2 min)" video link — all
- Time Clock tile (Clock In/Out) — all
- Capture tile → modal: Take a photo / Library (uploads to `capture_staging`) — all
- Shopping List tile → `/shopping-list` — all
- Kitchen Timer tile → modal: Name/Minutes + Add, Pause/Start, Remove (per timer) — all
- Handbook tile, Inventory tile — all
- Today's Duties checklist (per-task checkbox) — staff only (section absent, not redirected, for owner/manager)
- Today's Tasks card header collapse/expand — all
- Mark done/Reopen (per task) — all, but list is pre-scoped to viewer's own assignments; action requires assignment-to-viewer or manager
- Pin/expand (per task) → note input, add/replace photo, Mark done, Report an issue — same gate as above
- Shift Handover form + Recent Shift Notes (embedded) — same controls as the standalone route below — all

### /properties/[id]/shift-handover
**Page title:** Shift Notes
**Controls:**
- Quick template chips (Dinner staged / Fridge restocked / Issue reported) — all
- Note textarea, "Also did" textarea — all
- Photo button (camera) / Library button — all
- Remove-photo (✕) per thumbnail — all
- Record/Re-record, Stop (recording) — all
- Audio playback control — all
- "Leave shift note" submit — all
- "Create end of day note" (empty state) — all

---

### /properties/[id]/staff
**Whole page:** owner/manager only — staff redirected to `/inventory`.
**Page title:** Staff
**Controls:**
- Team Members card collapse/expand — owner+manager
- Zone Edit/Done toggle (per member) + zone checkboxes (Kitchen/Pantry/Primary Suite/Guest House) — owner+manager
- Role select (per member) — owner only (disabled for manager)
- Remove (per non-owner member) — owner+manager
- Offboard (remove from all properties) — owner+manager
- Shift Notes card collapse/expand — owner+manager
- Quick template pills, Note textarea, "Also did" textarea — owner+manager
- Photo / Library / remove-photo (✕) — owner+manager
- Record / Stop, "Leave shift note" submit — owner+manager
- Recent Shift Notes card collapse/expand — owner+manager
- "Create end of day note" (empty state) — owner+manager
- Add Person: full name, role select, property checkboxes (if managing >1), Email invite/Issued login toggle, email/login input, password input (issued-login only), submit — owner+manager
- Dismiss (issued-login credentials panel / access-confirmation panel) — owner+manager
- Resend (per pending invite) — owner+manager

### /properties/[id]/staff/duty-roster
**Page title:** Task Center (identical content also mounted at `/tools/tasks`)
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Controls:**
- "Verify completions →" link to `/tools/task-verification` — owner+manager
- "+ Add Task" — owner+manager
- Floor tabs, Search, Day/Room/Job/Frequency/Assignment filters — owner+manager
- "Show N retired tasks" checkbox — owner+manager
- Room section header collapse/expand — owner+manager
- Clear filters — owner+manager
- Per-tile room select, Reactivate (retired), Edit, Retire (confirm) — owner+manager
- Show/Hide procedure, "View full procedure →" — owner+manager
- Per-tile assignee select — owner+manager
- Add/Edit Task modal: task EN/ES, room, frequency, job type, time of day, day of week, minutes, photo (take/choose/remove), cancel, save — owner+manager

### /properties/[id]/staff/handbook
**Page title:** No page-level `<h1>` — tab bar (Household Guide / Training Videos / Procedures); each tab renders its own heading (Guide: "Staff Handbook," Procedures: "Procedures," Videos: none).
**Whole page:** not role-gated — any signed-in member can view.
**Tab bar:** switch Guide/Training Videos/Procedures (lazy-loaded on first switch) — all
**Guide tab:** Search input; Question card expand/collapse; "Go to" destination link inside an expanded card — all
**Training Videos tab:** Video player (native controls, marks watched on end); "Open this page" link (if the video has an associated app page) — all
**Procedures tab:** Search input; Procedure card expand/collapse; Poster thumbnail → lightbox; lightbox close (button/backdrop/Escape) — all. "Edit method" button, Method EN/ES textareas, Cancel, Save, Add/Replace poster (with cropper), Poster remove (✕), "Require a completion photo" checkbox — owner+manager only

### /properties/[id]/staff/hours
**Whole page:** pure redirect to `/tools/tasks#hours` — no rendered UI of its own.
**Destination section:** owner/manager only; entirely read-only (weekly hours per person). No controls — corrections are made directly in Supabase, by design.

### /properties/[id]/staff/sops
**Whole page:** pure redirect to `/staff/handbook?tab=procedures` (forwards `?sop=<id>`). See Procedures tab above for controls.

### /properties/[id]/staff/training
**Page title:** none rendered
**Whole page:** not role-gated — same `TrainingVideosTab` component/data as the Handbook's Training Videos tab.
**Controls:** Video player (native controls, marks watched); "Open this page" link — all

---

### /properties/[id]/tools (Tools Hub landing page)
**Page title:** Tools
**Controls:**
- Group header pin (Scanners / Kitchen / House) — collapse/expand — all
- Subgroup header pin (Prep & Reset / Calendar / Reference / Capture Tools / Admin Cleanup) — collapse/expand — all ("Admin Cleanup" subgroup itself is owner+manager only — staff never see it exists)
- Every tool tile navigates to (or opens a modal for) its own tool — see below for the role each destination actually enforces. Tile visibility itself: Staff Task Center, Suppliers, Full Backup (owner only), Needs Linking, Duplicate Ingredients, Capture Inbox, Room Photo Review, Photo Worklist, Hechsher Verification, Kosher Type Tagging, Translation Worklist, Household Digest, Guest & Family Taste Memory (also gated on the `guest_taste_memory` flag) are hidden from staff at the tile level; everything else is visible to all.
- "Home Memory Timeline" tile: defined in code but not wired into any group — no tile actually renders (route still works by direct link).
- "Kitchen Timer" tile: deliberately removed from the grid (still reachable via `/tools/kitchen-timer` and from Recipes' floating timer).

### /properties/[id]/tools/backup
**Page title:** (next-intl `backup.title`)
**Whole page:** owner only.
**Controls:** Download backup button (label switches to "preparing…" in flight) — zip-exports every table for the property — owner only

### /properties/[id]/tools/borrowed-items
**Page title:** Borrowed & Lent
**Controls:**
- Search box — all
- "We borrowed"/"We lent" toggle, item name, borrowed-from/lent-to, expected return date, Notify dropdown, notes, Log item — owner+manager (form only renders for them)
- Mark returned (per active item) — all
- Delete (✕, per item) — owner+manager

### /properties/[id]/tools/capture-inbox
**Page title:** Capture Inbox
**Whole page:** owner/manager only (view-level block, not a server redirect).
**Controls:**
- Borrowed/lent banner link (if items still out) — owner+manager
- Type filter chips (All/Recipe/Inventory/Meal Plan, with counts) — owner+manager
- "Snap a photo to start" → embedded capture flow — owner+manager
- Per-capture editable fields (vary by type: inventory photo/name/ES name/category/location/notes; recipe name/notes; meal-plan date/course/name) — owner+manager
- Reject / Approve (per capture) — owner+manager

### /properties/[id]/tools/contacts
**Page title:** Contacts & Vendors
**Controls:**
- Search box — all
- CSV import (choose file, Import N contacts, Cancel) — owner+manager
- Add/Edit form (name/role/phone/email/tags), Add contact/Save changes, Cancel — owner+manager
- Edit / Delete (✕, per contact) — owner+manager
- Call (tel:) / Email (mailto:) links — all

### /properties/[id]/tools/digest
**Page title:** Household Digest
**No role gate anywhere in the route** — "manager only" enforced only by hiding the Tools Hub tile and sitemap entry.
**Controls:** Edit Meal Plan link; Order button (per low-stock item, opens reorder link/Amazon fallback) — all. Otherwise view-only.

### /properties/[id]/tools/duplicate-ingredients
**Page title:** Duplicate Ingredients
**No role gate anywhere in the route.**
**Controls:** Search box (once duplicates exist); "Keep '<variant>'" button (per spelling variant) — merges every other variant into the chosen one across all recipes — all

### /properties/[id]/tools/guest-scaler
**Page title:** Simcha Guest Scaler
**Controls:**
- New event form (Event/Date/Guests/Notes), Add event — owner+manager
- Event list buttons (select/deselect active) — all
- Print Prep Pack — all
- Edit/Delete active event — owner+manager
- "Load from meal plan date" + Load — all
- Recipe search + add / Remove recipe (✕) — all
- "Push Scaled Quantities to Shopping List" — all

### /properties/[id]/tools/ingredient-scanner
**Page title:** Ingredient Scanner
**Controls:** Photo/Type-it-in toggle; camera/library capture; text + Analyze; Try another — all

### /properties/[id]/tools/kitchen-timer
**Page title:** Kitchen Timer
**No role gate.**
**Controls:** Name+Minutes+Add; Pause/Start (per timer); Remove (✕, per timer) — all

### /properties/[id]/tools/knowledge-base
**Page title:** House Manual
**Whole page:** owner/manager only (view-level block). Note: the Tools Hub tile itself is NOT hidden from staff for this one — staff can see and click it before hitting the block.
**Controls:** Search; draft banner (resume/discard); Question/Answer/Category fields + Add entry; Delete (✕, per entry) — owner+manager

### /properties/[id]/tools/memory-timeline
**Page title:** Home Memory Timeline
**No page-level role gate; no Tools Hub tile exists** (hidden pending a build-or-kill decision — still reachable by direct URL).
**Controls:** Event/Photo/Milestone type toggle, title/description fields, photo capture, date, Add — owner+manager (form only renders for them). Filter chips (All/Event/Photo/Milestone) — all. Delete (✕, per memory) — owner+manager

### /properties/[id]/tools/needs-linking
**Page title:** Needs Linking
**No role gate anywhere in the route.**
**Controls:** Water group expand/collapse; "Link all to <match>"; "Link All to Inventory Item…"; "Ignore All Water"; per-ingredient checkbox/row; single-item link view (search + link); Ignore / mark not-food; bulk bar (Link selected/Ignore selected/Clear) — all

### /properties/[id]/tools/pantry-zones
**Page title:** Pantry Zone Map
**Controls:**
- Search box — all
- Add a zone form (name/location/description), Add zone — owner+manager
- Camera icon (per zone, AI item suggestions) — all, by design
- Photo scan review (per-suggestion checkbox, Cancel, "Add checked (N)") — all
- Delete zone (✕) — owner+manager

### /properties/[id]/tools/photo-review
**Page title:** Room Photo Review
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Controls:** "Choose photos to upload"; per-photo room dropdown; Assign; Skip — owner+manager

### /properties/[id]/tools/photo-worklist
**Page title:** (next-intl `photoWorklist.title`)
**No role gate anywhere in the route.**
**Controls:** Item row button (per item needing a photo) — opens camera, uploads, clears the "needs sourcing" flag — all

### /properties/[id]/tools/prep-timeline
**Page title:** Prep Timeline
**Controls:** Date picker; Ready-time picker; "Plan a meal for this day →" (if nothing planned) — all. Otherwise view-only.

### /properties/[id]/tools/price-scanner
**Page title:** Price Scanner
**Controls:** Photo/Type-it-in toggle; camera/library capture; text field + Analyze; Try another — all

### /properties/[id]/tools/quick-photo
**Page title:** (next-intl `quickPhotoCapture.title`)
**No role gate; no Tools Hub tile** (linked from Dashboard instead).
**Controls:** Take Photo / Choose Photo; Retake; item name (with match suggestions); Spanish name (required); quantity; Submit/Save (upserts inventory by name) — all

### /properties/[id]/tools/recipe-stealer
**Page title:** Recipe Scanner
**Controls:** Photo/Type-it-in toggle; camera/library capture; text + Analyze; result editor (name/ES name/ingredients/method EN+ES); Try another; "Save for review" (→ Capture Inbox, never writes directly to recipes); Scan another — all

### /properties/[id]/tools/reset-checklist
**Page title:** Reset Checklists
**Controls (per template):** task checkbox (per section); assignee dropdown (per task); Save Draft; Mark All Complete — all

### /properties/[id]/tools/suppliers
**Page title:** (next-intl `suppliers.title`)
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Controls:** Search (auto-expands matches); store header expand/collapse (per supplier); reorder link (per item); "Open Inventory" link — owner+manager

### /properties/[id]/tools/takeout-directory
**Page title:** Local Takeout Directory
**Controls:**
- "+ Add" → form (name required, category, phone, WhatsApp, address, city, hours, website, hashgacha, confirmed checkbox, delivery checkbox), Save, Cancel — owner+manager
- Search, category filter chips, hashgacha filter chips — all
- Call/WhatsApp/Website links — all
- Edit / Remove (confirm) — owner+manager

### /properties/[id]/tools/task-verification
**Page title:** (next-intl `taskVerification.title`)
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Controls:** Window filter (7/14/30/All days); Outcome filter (All/Passed/Issues); photo thumbnail → lightbox — owner+manager. Otherwise view-only by design (no editing of completions here).

### /properties/[id]/tools/tasks
**Page title:** (next-intl `dutyRoster.title`, e.g. "Duty Roster") + an "Hours" section below
**Whole page:** owner/manager only, staff redirected to `/inventory`.
**Duty Roster controls:** "View Task Verification" link; "+ Add Task"; floor tabs; search; day/room/job/frequency/assignment filters; "Show retired (N)" checkbox; room section collapse/expand; Clear filters; per-tile room dropdown, Reactivate, Edit, Retire (confirm), Show/Hide procedure, "View full procedure →", assignee dropdown; Add/Edit Task modal (task EN/ES required, room, frequency, job type, time of day, day of week, minutes, photo, cancel, save) — owner+manager
**Hours section:** read-only, no controls — owner+manager

### /properties/[id]/tools/taste-memory
**Page title:** Guest & Family Taste Memory
**Whole page:** gated only by the property's `feature_flags.guest_taste_memory` — if off, ANY role is redirected to `/tools`. If on, no further role gate in the page itself (staff could reach it directly even though its tile is hidden from them).
**Controls:** Add a person (name, family/guest toggle, active checkbox, notes, link to Contacts), Add person, Delete (✕); "+ Add preference" (per person) → type toggle (Like/Dislike/Allergy/Sensitivity), subject, link type (none/recipe/inventory item + search), notes, Cancel/Add; Delete preference (✕) — owner+manager

### /properties/[id]/tools/translation-worklist
**Page title:** (next-intl `translationWorklist.title`)
**Whole page:** owner/manager only (view-level block; data fetch also skipped for non-managers).
**Controls:** Translation input (per row missing a Spanish name); Save (per row) — owner+manager

### /properties/[id]/tools/yom-tov-year-view
**Page title:** (next-intl `yomTovYearView.title`)
**Controls:** List/Calendar toggle (persisted); Jump to Date panel + Today; Prev/Next month (calendar view); day cells (visual only) — all. Otherwise view-only.

---

## Part 2 — Cross-property / account routes

### /properties
**Page title:** Your properties
**Note:** SS-372 (2026-07-30) — households now render as a heading (brass label + hairline) shown only when a household holds 2+ properties, never as a card; no expand/collapse, no chevron. Every property is a plain card in one flat grid. "Add a property" is that grid's own trailing cell.
**Controls:**
- Sign out — all
- Property card (per property, in its household's group or standalone) — navigates to that property's Dashboard (owner/manager) or My Day (staff) — all
- "Add a property" card — navigates to `/properties/new` — all
- "Shop for multiple properties at once" link (shown only if the user belongs to >1 property) — navigates to `/procurement` — all

### /properties/new
**Page title:** Add a property
**Controls:**
- Property name input (required) — all
- Household toggle "New household"/"Existing household" — only rendered if the caller already owns/manages at least one household-linked property — owner+manager
- Household picker (dropdown, Existing household mode) — owner+manager
- "Create property" submit — calls `create_property_with_household` (re-validates existing-household attachment server-side), redirects to the new property's Inventory — all

### /procurement
**Page title:** Procurement
**Whole page:** owner/manager only — non-qualifying callers redirected to `/properties`.
**Controls:** "Properties" link (back); include-properties chips (toggle per property); "Low Stock by Property" cards (read-only); "Hide picked up" checkbox; Print button; item checkbox (per merged item, marks purchased across every property it was pulled from) — owner+manager

### /help
**Page title:** Help Center
**Note:** property-agnostic, not scoped to any one property.
**Controls:** Back button; search input; category header expand/collapse; article card expand/collapse (deep-linkable via `?article=`/`?category=`) — all

### /login
**Page title:** Welcome back
**Public route.**
**Controls:** Locale toggle; wordmark → `/entry`; email/password inputs; "Remember me" checkbox; "Forgot password?"; "Sign in with Google"; "Sign In" submit → `/properties`; "Create an account" → `/signup` — all

### /signup
**Page title:** Create your account
**Public route.**
**Controls:** Locale toggle; wordmark → `/entry`; signup code (required); household name; email; password/confirm; "Sign up with Google"; "Create Account" submit (creates account+household+property via `/api/signup`) → `/properties`; "Sign in" → `/login` — all

### /forgot-password
**Page title:** Reset your password (post-submit: "Check your inbox")
**Public route.**
**Controls:** Locale toggle; wordmark → `/entry`; email input; "Send Reset Link"; "Back to Sign In"/"Try a different address" (post-send) — all

### /reset-password
**Page title:** Set a new password
**Note:** gated by the global auth middleware in principle, reachable in practice because `/auth/callback` has already established a recovery session.
**Controls:** New password / confirm inputs; "Save password" → `/properties` — all

### /auth/confirm
**Page title:** none (transient "Signing you in…")
**Public technical handoff route** for admin-generated invite links (hash-fragment session exchange). No user-facing controls — automatic redirect to `?redirectTo=` (default `/properties`) or `/login?error=auth-link-failed`.

### /entry
**Page title:** no literal `<h1>` — wordmark "Sorted & Stocked," tagline "Welcome home."
**Public pre-auth landing screen** (not a forced first stop — `/` still bypasses it).
**Controls:** Locale toggle; "Sign In" → `/login`; "Create an Account" → `/signup` — all

### /manager
**Page title:** Manager Platform
**Whole page:** platform-manager only (`is_platform_manager()`, a separate flag from property roles). Per an in-code comment, Phase 1 isn't active yet (its RPC doesn't exist until a not-yet-applied migration), so this redirects everyone today, Racquel included.
**Controls:** Tab bar (Inventory all clients / Recipes all clients / Shared Library / Onboard New Client); client filter dropdown; search + button; "Approve to library" (per row); "Retire" (per row, Library tab); property picker (Onboard tab); "Copy library into this property" — platform manager only

### /dashboard
**Page title:** none — pure redirect.
**Note:** legacy bookmark-compat route; real Dashboard lives at `/properties/[id]/dashboard`. Redirects single-property users straight in (dashboard or my-day per role); everyone else to `/properties`.

### /scan
**Page title:** none — pure redirect.
**Note:** legacy stub; real scanner lives at `/properties/[id]/scan`. Redirects to `/properties`.

### /scan/[code]
**Page title:** "Barcode Not Recognized" (only state with rendered content — a matched code redirects before rendering anything)
**Controls:** (item found) none — auto-redirects into that item's own property's scan page, pre-filled. (not found) "Return to Home" link → `/` — all
