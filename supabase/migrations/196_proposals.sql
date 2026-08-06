-- 196_proposals.sql
-- The homeowner review and approval queue. The client owns the property,
-- Sort + Place manages it (SS-546), so a manager PROPOSES and only the
-- owner DECIDES.
--
-- A PROPOSAL LIVES ONLY HERE. Nothing enters recipes or inventory_items
-- until approval; approving is what creates the row. The rejected
-- alternative was a draft row in the live table, which would have required
-- every search, every meal plan picker, every inventory count and every
-- low-stock view to learn to exclude pending rows forever, and the first
-- one that forgot would leak an unapproved item into a client's house.
--
-- NO AUTO-APPROVE PATH AND NO INTERNAL-PROPERTY EXEMPTION exists in this
-- file, deliberately. Approval is real on all five properties from day one.
--
-- DATA NOTE, TRUE AT THE TIME OF WRITING AND NOT FIXED HERE: only Henderson
-- has a real client owner (Jessica). Racquel currently holds owner on
-- Country, Lax, Low and Main, so on those four the same person can propose
-- and approve. The separation below is enforced correctly regardless; it
-- simply has no teeth until the ownership data is corrected. That is
-- SS-546, and it is a data fix, not a code one.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  kind text not null check (kind in ('meal_plan_week','recipe','inventory_item')),

  -- Full proposed content for recipe / inventory_item. Null for a meal
  -- plan week, which proposes a REVIEW of rows that already exist.
  payload jsonb,
  week_start date,

  proposed_by uuid not null references auth.users(id),
  note_en text,
  note_es text,

  status text not null default 'pending'
    check (status in ('pending','approved','declined','changes_requested')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note_en text,
  decision_note_es text,

  -- The recipes / inventory_items row this proposal created on approval.
  created_row_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A meal plan week is identified by its week, the other kinds by their
  -- payload. Keeping that honest here rather than trusting the caller.
  constraint proposals_week_shape check (
    (kind = 'meal_plan_week' and week_start is not null)
    or (kind <> 'meal_plan_week' and payload is not null)
  )
);

-- One PENDING meal plan week per property per week. Partial on purpose: a
-- week that was declined must be re-proposable, so only pending rows
-- collide.
create unique index if not exists proposals_one_pending_week
  on public.proposals (property_id, week_start)
  where kind = 'meal_plan_week' and status = 'pending';

create index if not exists proposals_property_status_idx
  on public.proposals (property_id, status);

create index if not exists proposals_proposed_by_idx
  on public.proposals (proposed_by);

alter table public.proposals enable row level security;

-- SELECT: the proposer sees their own at any status; an owner or manager on
-- that property sees all of it. Staff see nothing.
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals for select to authenticated
using (
  proposed_by = auth.uid()
  or exists (
    select 1 from public.property_members pm
    where pm.property_id = proposals.property_id
      and pm.user_id = auth.uid()
      and pm.role = any (array['owner'::member_role, 'manager'::member_role])
  )
);

-- INSERT: a manager or owner on that property, and only ever as themselves.
-- Always pending: a proposal cannot be born approved.
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated
with check (
  proposed_by = auth.uid()
  and status = 'pending'
  and decided_by is null
  and created_row_id is null
  and exists (
    select 1 from public.property_members pm
    where pm.property_id = proposals.property_id
      and pm.user_id = auth.uid()
      and pm.role = any (array['owner'::member_role, 'manager'::member_role])
  )
);

-- UPDATE: the PROPOSER may edit their own proposal, but ONLY while it is in
-- changes_requested, and only back to pending. That is the resubmit leg of
-- the conversation.
--
-- DECIDING IS NOT DONE THROUGH THIS POLICY. There is deliberately no
-- policy letting anyone set status to approved or declined directly,
-- because approving a recipe has to insert the recipe AND its ingredients
-- in one transaction. Decisions go through decide_proposal() below, which
-- checks owner itself. A direct UPDATE to 'approved' by any client is
-- rejected by the WITH CHECK here.
drop policy if exists proposals_update_resubmit on public.proposals;
create policy proposals_update_resubmit on public.proposals for update to authenticated
using (proposed_by = auth.uid() and status = 'changes_requested')
with check (proposed_by = auth.uid() and status = 'pending');

-- No DELETE policy. Never delete a proposal, same rule as the register.

-- Keep updated_at honest without trusting callers.
create or replace function public.proposals_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.proposals_touch_updated_at();

-- ---------------------------------------------------------------------
-- decide_proposal: the ONLY way a proposal reaches a terminal state.
--
-- SECURITY DEFINER because approving must insert into recipes,
-- recipe_ingredients or inventory_items, which the owner may not be able
-- to write directly, and because the whole thing must be ONE transaction:
-- a partial insert leaves a recipe with no ingredients in a client's
-- house. A function body is that transaction.
--
-- Being SECURITY DEFINER, it does its OWN authorisation and never trusts
-- the caller: owner on that property, that role only. Managers cannot
-- approve, which is the entire point of the feature.
--
-- The payload is read through an explicit COLUMN ALLOWLIST, never
-- jsonb_populate_record. A proposer controls the payload, and populate
-- would let them set id, property_id or created_at and write a row into a
-- different client's house.
-- ---------------------------------------------------------------------
create or replace function public.decide_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note_en text default null,
  p_note_es text default null
)
returns public.proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.proposals;
  v_new_id uuid;
  v_ing jsonb;
begin
  if p_decision not in ('approved','declined','changes_requested') then
    raise exception 'decide_proposal: invalid decision %', p_decision
      using errcode = '22023';
  end if;

  -- Lock the row so two owners deciding at once cannot both insert.
  select * into v_p from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'decide_proposal: proposal not found' using errcode = 'P0002';
  end if;

  -- Terminal means terminal. Undoing is a new proposal, never a
  -- re-decision, so the record of what was decided cannot be rewritten.
  if v_p.status <> 'pending' then
    raise exception 'decide_proposal: proposal is % and cannot be decided again', v_p.status
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.property_members pm
    where pm.property_id = v_p.property_id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'::member_role
  ) then
    raise exception 'decide_proposal: only the property owner may decide'
      using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    if v_p.kind = 'recipe' then
      insert into public.recipes (
        property_id, name, name_es, servings, notes, course, instructions_en,
        instructions_es, kosher_type, is_shabbos_only, is_pesach, tags,
        approx_total_minutes, prep_lead_days, is_yom_tov, equipment
      )
      select
        v_p.property_id,
        nullif(v_p.payload->>'name',''),
        v_p.payload->>'name_es',
        coalesce((v_p.payload->>'servings')::int, 4),
        v_p.payload->>'notes',
        v_p.payload->>'course',
        v_p.payload->>'instructions_en',
        v_p.payload->>'instructions_es',
        v_p.payload->>'kosher_type',
        coalesce((v_p.payload->>'is_shabbos_only')::boolean, false),
        coalesce((v_p.payload->>'is_pesach')::boolean, false),
        case when v_p.payload ? 'tags'
             then array(select jsonb_array_elements_text(v_p.payload->'tags')) end,
        (v_p.payload->>'approx_total_minutes')::int,
        (v_p.payload->>'prep_lead_days')::int,
        coalesce((v_p.payload->>'is_yom_tov')::boolean, false),
        case when v_p.payload ? 'equipment'
             then array(select jsonb_array_elements_text(v_p.payload->'equipment')) end
      returning id into v_new_id;

      -- Same transaction. This is the reason this is a function.
      for v_ing in
        select jsonb_array_elements(coalesce(v_p.payload->'ingredients','[]'::jsonb))
      loop
        insert into public.recipe_ingredients
          (recipe_id, name, name_es, quantity, unit, category, section_label)
        values (
          v_new_id,
          nullif(v_ing->>'name',''),
          v_ing->>'name_es',
          nullif(v_ing->>'quantity','')::numeric,
          v_ing->>'unit',
          v_ing->>'category',
          v_ing->>'section_label'
        );
      end loop;

    elsif v_p.kind = 'inventory_item' then
      insert into public.inventory_items (
        property_id, name, name_es, category, location_id, current_qty,
        min_qty, unit, notes, kosher_type, hechsher, supplier, unit_cost
      )
      select
        v_p.property_id,
        nullif(v_p.payload->>'name',''),
        v_p.payload->>'name_es',
        v_p.payload->>'category',
        (v_p.payload->>'location_id')::uuid,
        coalesce((v_p.payload->>'current_qty')::numeric, 0),
        coalesce((v_p.payload->>'min_qty')::numeric, 0),
        coalesce(nullif(v_p.payload->>'unit',''), 'pcs'),
        v_p.payload->>'notes',
        v_p.payload->>'kosher_type',
        v_p.payload->>'hechsher',
        v_p.payload->>'supplier',
        (v_p.payload->>'unit_cost')::numeric
      returning id into v_new_id;

    -- meal_plan_week creates NOTHING. The entries already exist; the
    -- proposal records that the week was reviewed.
    end if;
  end if;

  update public.proposals
     set status = p_decision,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note_en = p_note_en,
         decision_note_es = p_note_es,
         created_row_id = coalesce(v_new_id, created_row_id)
   where id = p_proposal_id
   returning * into v_p;

  return v_p;
end;
$$;

revoke all on function public.decide_proposal(uuid, text, text, text) from public;
grant execute on function public.decide_proposal(uuid, text, text, text) to authenticated;

comment on table public.proposals is
  'Homeowner review queue. A manager proposes, only the property owner decides, via decide_proposal(). A proposal lives ONLY here: nothing enters recipes or inventory_items until approval, so no live-table query has to learn to hide pending rows. Approved and declined are terminal; undoing is a new proposal. Never deleted.';
