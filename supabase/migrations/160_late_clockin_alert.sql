-- 160_late_clockin_alert.sql
-- SS-449 (U): late clock-in alert, phase 1 (SMS + email; push is a
-- separate phase-2 proposal).
--
-- R20 check done before adding anything: shift_schedules already holds
-- exactly the per-person shift start the spec needs (staff_user_id,
-- day_of_week, start_time, active) -- NO new schedule columns. Two facts
-- about that table worth recording: it has 0 rows today, and no UI writes
-- it (only the backup tool references it) -- so the alert pipeline ships
-- armed but silent until schedules are entered. day_of_week: schedule
-- rows use 0=Sunday (confirmed 31 Jul; Mon-Sat share digits with the ISO
-- convention, and the function accepts 0 OR 7 on Sunday so neither
-- convention can miss).
--
-- The clock-in signal is shifts.clocked_in_at -- the Time Clock pill on My
-- Day (SS-285, ClockInOutButton) is live and is the real clock-in path.
--
-- Three pieces:
--   1. sms_log gains the 'late_clockin' trigger value.
--   2. late_clockin_alerts: one row per (schedule, day) = the idempotency
--      that keeps a 15-minute cron from re-nagging (same reasoning as
--      borrowed_items.reminder_sent_at: marked even when the send fails
--      or is skipped, so a broken config surfaces once, not forever).
--      Service-role only: RLS enabled with no policies, plus explicit
--      revokes, matching the anon_rate_limit_events hardening in 156.
--   3. pg_cron every 15 minutes, 11:00-23:45 UTC (roughly 7am-7pm in New
--      Jersey; the function itself reasons in America/New_York, the cron
--      window just avoids pointless overnight runs), same vault-key
--      net.http_post pattern as the three existing jobs.

alter table sms_log drop constraint sms_log_trigger_check;
alter table sms_log add constraint sms_log_trigger_check
  check ("trigger" = any (array[
    'task_assigned'::text, 'shift_handover'::text, 'broadcast'::text,
    'payment_reminder'::text, 'borrowed_item_reminder'::text, 'late_clockin'::text
  ]));

create table late_clockin_alerts (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references shift_schedules(id) on delete cascade,
  alert_date date not null,
  sms_status text,
  email_status text,
  created_at timestamptz not null default now(),
  unique (schedule_id, alert_date)
);

comment on table late_clockin_alerts is
  'SS-449: one row per (shift_schedules row, local date) the late alert ran for. Written only by the send-late-clockin-alert edge function (service role); no client access.';

alter table late_clockin_alerts enable row level security;
revoke all on late_clockin_alerts from anon;
revoke all on late_clockin_alerts from authenticated;

select cron.schedule(
  'late-clockin-alert-15min',
  '*/15 11-23 * * *',
  $$
  select net.http_post(
    url := 'https://jfaaqzrezcrkkidlsbwj.supabase.co/functions/v1/send-late-clockin-alert',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
