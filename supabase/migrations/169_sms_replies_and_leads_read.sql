-- 169_sms_replies_and_leads_read.sql
-- Two rulings from Racquel, 2 Aug:
--
-- (1) SS-436 both-yes: staff replies to alert texts ("Running late?"
-- responses) must be visible inside the Lax console. Nothing stored
-- inbound SMS before this -- sms_log is outbound-only -- so this is the
-- inbound lane: rows written ONLY by the Twilio webhook route
-- (app/api/sms/inbound, service role). Reader is the operator console;
-- same owner/manager read shape as sms_log, keyed to the matched
-- property, with unmatched replies (unknown numbers) readable only where
-- a property match exists -- an unmatched row has no property and is
-- visible to no client role until matched.
create table public.sms_replies (
  id               uuid primary key default gen_random_uuid(),
  from_phone       text not null,
  body             text not null,
  twilio_sid       text unique,
  -- Matched at insert time by the webhook: profiles.phone_number ->
  -- user -> their property membership(s). Nullable on purpose: an
  -- unknown number still gets stored (losing a real reply is worse than
  -- an orphan row), it just isn't client-visible until matched.
  matched_user_id  uuid references auth.users(id) on delete set null,
  property_id      uuid references public.properties(id) on delete set null,
  received_at      timestamptz not null default now()
);

create index idx_sms_replies_property on public.sms_replies(property_id, received_at desc);

alter table public.sms_replies enable row level security;
revoke all on public.sms_replies from anon;

create policy "sms_replies_select_owner_manager"
  on public.sms_replies for select
  using (
    property_id is not null
    and exists (
      select 1 from public.property_members pm
      where pm.property_id = sms_replies.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );

comment on table public.sms_replies is
  'Inbound staff SMS (alert replies). Written only by app/api/sms/inbound (service role, Twilio webhook). Read-only in the operator console (SS-436 both-yes ruling, 2 Aug).';

-- (2) Leads backup: the console gains a collapsible owner-only
-- consultation-requests fold with an UNREAD badge. read_at is the read
-- marker; NULL = unread. Existing rows stay NULL deliberately -- they
-- were never surfaced in-app, so they genuinely are unread.
alter table public.consultation_requests add column read_at timestamptz;

comment on column public.consultation_requests.read_at is
  'When an owner first saw this lead in the console fold (2 Aug ruling). NULL = unread; drives the badge.';
