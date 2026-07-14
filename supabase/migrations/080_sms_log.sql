-- Audit log for every staff SMS send attempt (task assignment, shift
-- handover, and owner/manager broadcast triggers) -- real auditability per
-- Racquel's explicit ask, not fire-and-forget. Logs both success and
-- Twilio-side failure; a recipient who is opted out or has no phone number
-- never reaches this table at all, since no send was ever attempted for them.
create table public.sms_log (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  recipient_user_id  uuid references auth.users(id) on delete set null,
  phone_number       text not null,
  message            text not null,
  trigger            text not null check (trigger in ('task_assigned', 'shift_handover', 'broadcast')),
  sent_by            uuid references auth.users(id) on delete set null,
  status             text not null check (status in ('sent', 'failed')),
  error              text,
  created_at         timestamptz not null default now()
);

create index idx_sms_log_property_id on public.sms_log(property_id);

alter table public.sms_log enable row level security;

-- Owner/manager only -- this is an internal audit trail, not something a
-- staff member needs to browse (it would also expose other staff's phone
-- numbers). No insert/update/delete policy for any client role: every row
-- is written by sendStaffText() via the service-role admin client only.
create policy "sms_log_select_owner_manager"
  on public.sms_log for select
  using (
    exists (
      select 1 from public.property_members pm
      where pm.property_id = sms_log.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );
