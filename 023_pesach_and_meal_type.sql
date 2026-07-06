-- ============================================================================
-- 023: Pesach menu + meat/dairy meal-type toggle
-- ============================================================================
-- Pesach gets its own menu layer (menu_type) so it never shows on the
-- regular weekly screen -- same calendar dates, a separate set of entries,
-- switched via a dropdown. Recipes get an is_pesach flag so the recipe
-- picker can restrict to Pesach-kosher dishes while in that mode.
--
-- meal_plan_day_settings holds one explicit meat/dairy/parve choice per
-- (property, date, menu_type) -- set once, it filters which side-dish
-- recipes are offered for that day, and can be flipped at any time (e.g.
-- switching a planned meat meal to a dairy one re-filters the suggestions).
-- ============================================================================

alter table public.recipes
  add column if not exists is_pesach boolean not null default false;

alter table public.meal_plan_entries
  add column if not exists menu_type text not null default 'regular'
  check (menu_type in ('regular', 'pesach'));

create table public.meal_plan_day_settings (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  plan_date   date not null,
  menu_type   text not null default 'regular' check (menu_type in ('regular', 'pesach')),
  meal_type   text check (meal_type in ('meat', 'dairy', 'parve')),
  updated_at  timestamptz not null default now(),
  unique (property_id, plan_date, menu_type)
);

alter table public.meal_plan_day_settings enable row level security;

create policy "day_settings_select_member"
  on public.meal_plan_day_settings for select
  using (public.is_property_member(property_id));

create policy "day_settings_insert_member"
  on public.meal_plan_day_settings for insert
  with check (public.is_property_member(property_id));

create policy "day_settings_update_member"
  on public.meal_plan_day_settings for update
  using (public.is_property_member(property_id));
