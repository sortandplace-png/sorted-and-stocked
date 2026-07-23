-- 118_billing_square_payment_link.sql
-- Per-property Square Payment Link for Sort & Place's own subscription
-- billing. Always pasted in by an owner/manager after creating it in their
-- own Square Dashboard -- there is no Square API integration in this app,
-- so the app never generates, guesses, or fabricates a link.
alter table properties
  add column square_payment_link text,
  add column square_payment_link_sent_at timestamptz,
  add column square_payment_link_sent_via text check (square_payment_link_sent_via in ('email', 'sms'));

-- Give payment reminders their own sms_log trigger value rather than
-- overloading 'broadcast', so the audit trail stays legible.
alter table sms_log drop constraint sms_log_trigger_check;
alter table sms_log add constraint sms_log_trigger_check
  check (trigger = any (array['task_assigned', 'shift_handover', 'broadcast', 'payment_reminder']));
