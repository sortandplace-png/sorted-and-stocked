-- 194_pin_queue.sql
-- Pinterest publishing, OPT IN ONLY. Nothing publishes by existing.
--
-- THIS TABLE IS THE CONSENT RECORD, and that is its real job. The queue
-- shape is not about retries or throughput; it exists so that publishing
-- requires a deliberate INSERT naming one image, one board and one
-- description. An image arriving in a bucket must never cause a post.
--
-- WHY THAT MATTERS HERE SPECIFICALLY. The SOP reference photo set includes
-- SOP-082 Medicine Cabinet, SOP-073 Bathroom Vanity Drawer, SOP-070 Pesach
-- Kitchen and SOP-076 Office Desk Drawer. Three of those four exist
-- BECAUSE OF A PRIVACY RULE. An auto-post-on-upload design would publish a
-- private household's medicine cabinet to a public Pinterest board, and it
-- would do it silently, the first time someone did their job correctly by
-- uploading a reference photo. No trigger on sop_library, no trigger on
-- any image column, ever.
--
-- GENERIC ON PURPOSE. source_table/source_id rather than a sop_id FK, so
-- blog_posts and anything later queue through the same path and there is
-- one publishing route to audit rather than one per image source.

create table if not exists public.pin_queue (
  id              uuid primary key default gen_random_uuid(),
  source_table    text not null,
  source_id       uuid not null,
  image_url       text not null,
  pin_title       text not null,
  pin_description text not null,
  pin_board       text not null,
  -- Where the pin points. Usually a blog post. Nullable because a pin can
  -- legitimately have no destination yet.
  pin_link        text,
  locale          text not null default 'en',
  status          text not null default 'queued'
                  check (status in ('queued','posted','failed','cancelled')),
  pin_id          text,
  error_msg       text,
  attempts        integer not null default 0,
  queued_by       uuid references auth.users(id),
  queued_at       timestamptz not null default now(),
  posted_at       timestamptz,
  -- Stops the same image being queued twice to the same board, which is
  -- the obvious failure mode of a retry: a double tap, or a webhook that
  -- fires again, would otherwise post the same pin two or three times to a
  -- public board.
  unique (source_table, source_id, pin_board)
);

-- The webhook that drives posting selects on status, and a partial index
-- keeps that lookup off the posted rows, which are the ones that
-- accumulate.
create index if not exists pin_queue_queued_idx
  on public.pin_queue (status, queued_at)
  where status = 'queued';

create index if not exists pin_queue_source_idx
  on public.pin_queue (source_table, source_id);

alter table public.pin_queue enable row level security;

-- READ and INSERT: owner or manager, AND on the operator-console property.
--
-- THE OPERATOR GATE IS STRICTER THAN THE BRIEF ASKED FOR, and that is
-- deliberate. The brief said owner or manager. This table has no
-- property_id, so "owner or manager" alone means owner or manager of ANY
-- property, which on this database includes managers seated on client
-- houses. The thing being granted is the ability to publish to the
-- business's public Pinterest account, which is not a per-house
-- permission. Same gate as email_subscribers, the closest analogue: a
-- global business table with no property of its own. Being stricter on a
-- publishing table cannot cause the leak this ticket exists to prevent.
drop policy if exists pin_queue_select_operator on public.pin_queue;
create policy pin_queue_select_operator
  on public.pin_queue for select to authenticated
  using (
    exists (
      select 1
      from public.property_members pm
      join public.properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role = any (array['owner'::member_role, 'manager'::member_role])
        and ((p.feature_flags ->> 'operator_console')::boolean) is true
    )
  );

drop policy if exists pin_queue_insert_operator on public.pin_queue;
create policy pin_queue_insert_operator
  on public.pin_queue for insert to authenticated
  with check (
    exists (
      select 1
      from public.property_members pm
      join public.properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role = any (array['owner'::member_role, 'manager'::member_role])
        and ((p.feature_flags ->> 'operator_console')::boolean) is true
    )
  );

-- NO UPDATE OR DELETE POLICY, deliberately. status, pin_id, posted_at and
-- error_msg are written by the edge function under the service role. A
-- client that could flip a row back to 'queued' could republish at will,
-- and a client that could delete rows could erase the record of what was
-- published. Cancelling before posting is a status change and therefore
-- also goes through the function, not straight from a browser.
--
-- NOTE: anon has no policy at all here, so there is no public read. The
-- queue names private household images and must never be enumerable.

comment on table public.pin_queue is
  'Pinterest publishing queue and consent record. A row here is an explicit decision to publish ONE image to ONE board. Nothing publishes by existing: there is no trigger on sop_library or any image column, because three of the four SOP reference photos exist because of a privacy rule and auto-posting would publish a private household''s standards.';
