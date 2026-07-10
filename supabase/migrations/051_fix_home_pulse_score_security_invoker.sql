-- home_pulse_score was created SECURITY DEFINER (Postgres default), running as
-- its owner (postgres) and bypassing RLS on inventory_items/staff_tasks/
-- shopping_lists/properties. Combined with an anon SELECT grant, this let
-- any unauthenticated request read every property's pulse score. Switching
-- to security_invoker makes it run as the querying user, so RLS on the
-- underlying tables applies normally.
ALTER VIEW public.home_pulse_score SET (security_invoker = true);
REVOKE ALL ON public.home_pulse_score FROM anon;
