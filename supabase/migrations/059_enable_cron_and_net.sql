-- First-time infrastructure: enables scheduled jobs (pg_cron) and outbound
-- HTTP from Postgres (pg_net), needed for the Hebcal refresh + weekly
-- digest Edge Functions. Neither was enabled before this.
create extension if not exists pg_cron;
create extension if not exists pg_net;
