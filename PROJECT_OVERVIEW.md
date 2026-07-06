# Sorted & Stocked — Project Overview

A short brief so a fresh AI (or developer) can give useful feedback without the back-story.
Last updated: 2026-07-06.

## What it is
A multi-tenant Progressive Web App for household management, currently in use by one
client ("Strauss"). Three connected modules:
- **Inventory** — what's in the house, by room/location, with supplier, reorder link,
  photo, unit cost, notes, and a running history of quantity changes.
- **Meal Plan** — a weekly planner. Each day has courses (soup, protein, starch, vege,
  salad, dessert, kids platter). Dishes can link to a recipe; dessert only shows on
  Shabbos. Jewish-calendar (Hebcal) badges flag Yom Tov and fast days.
- **Shopping List** — grouped by grocery aisle; populated from the ingredients of the
  recipes linked in the meal plan.

## Tech stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v3.4
- Supabase (Postgres 17) for database + auth, with Row-Level Security
- next-pwa (installable app), html5-qrcode (barcode scanning), jspdf (PDF export)
- Anthropic API for AI features (recipe/label parsing) — needs ANTHROPIC_API_KEY set

## Multi-tenancy model
Every row is scoped to a `property_id`. Users join a property via `property_members`.
Row-Level Security enforces that you only see your own property's data. The code is
generic across clients; only the *data* is Strauss-specific.

## Data snapshot (row counts, 2026-07-06)
recipes 205 · recipe_ingredients 1267 · inventory_items 188 · meal_plan_entries 193
(95 linked to recipes) · shopping_list_items 88 · categories 19 · locations 18.

## What's working
- Auth, property membership, RLS, inventory CRUD, QR scanning
- Meal plan with courses, Hebcal holiday badges, print, responsive desktop layout
- Shopping list grouped by aisle, print
- Recipes with bilingual (English/Spanish) names

## Open / in-progress
- Two meals on Fri & Sat (Friday Night vs Shabbos Day), each with its own dishes,
  visually distinct by color.
- Separate Pesach menu behind a dropdown/toggle (off the main screen).
- Kosher-aware side switching: meat main → filter sides to meat/pareve; toggle meat↔dairy.
- Bulk-import reorder links & photos into inventory.
- Link the remaining meal-plan dishes (~98) to recipes.
- Backups routine + moving code into a private GitHub repo.

## How to give feedback
Useful angles: data model for the two-meal + Pesach design, UX for the kosher/Pesach
toggles, accessibility, performance, and anything security-related around RLS. Note:
the `.env.local` file (API keys) is intentionally NOT included in shared bundles.
