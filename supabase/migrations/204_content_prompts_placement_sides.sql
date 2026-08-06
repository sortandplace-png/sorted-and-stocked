-- 204_content_prompts_placement_sides.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.
--
-- A sideless "beside" never existed in the renderer, so the old CHECK
-- allowed a value nothing could draw. Constraint is dropped, the data is
-- migrated to sided tokens, then the constraint is re-added -- in that
-- order, because the update would fail against the old check.

alter table public.content_prompts
  drop constraint if exists content_prompts_placement_check;

update public.content_prompts
set placement = case
  when notes ilike '%half-right%' then 'beside-right'
  when notes ilike '%half-left%'  then 'beside-left'
  when notes ilike '%bleed%'      then 'bleed'
  -- Two rows carried no side in notes and were resolved individually
  -- rather than defaulted, so neither silently picked a side.
  when target_slug = 'blog-21-best-home-inventory-app-for-families' and sequence = 1 then 'beside-left'
  when target_slug = 'blog-03-training-household-staff' and sequence = 3 then 'beside-right'
  else placement
end
where scope = 'blog_post';

alter table public.content_prompts
  add constraint content_prompts_placement_check
  check (placement in (
    'header','stacked','full','wide','inline','bleed',
    'beside-left','beside-right','half-left','half-right'
  ));

comment on column public.content_prompts.placement is
  'Canonical renderer tokens are beside-left and beside-right. half-left and half-right are accepted aliases added by Code in 373bab8. A sideless beside never existed and is no longer permitted here.';
