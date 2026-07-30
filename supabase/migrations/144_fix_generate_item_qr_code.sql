-- 144_fix_generate_item_qr_code.sql
-- BLOCKER: every INSERT into inventory_items failed with 42883, function
-- gen_random_bytes(integer) does not exist. Confirmed live: pgcrypto IS
-- installed (schema extensions), but this trigger function carries
-- `SET search_path TO 'public', 'pg_temp'`, which does not include
-- extensions -- reproduced the exact failure by running
-- `set local search_path to public, pg_temp; select gen_random_bytes(6);`
-- directly, same 42883.
--
-- Option (b), not (a): dropping the pgcrypto dependency entirely rather
-- than adding extensions to this function's search_path. Lower risk --
-- doesn't depend on schema search_path staying correct going forward, and
-- gen_random_bytes was never doing anything cryptographic here anyway,
-- just generating an 8-hex-char code. Same charset (uppercase hex), same
-- length, same 'ITM-' prefix -- format is unchanged, so print-labels and
-- the scanner (both of which read qr_code) need no changes.
create or replace function public.generate_item_qr_code()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.qr_code is null then
    new.qr_code := 'ITM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  end if;
  return new;
end;
$function$;

-- Same bug, same fix, found by checking every other function for the same
-- dependency per the report's own instruction: generate_location_qr_code
-- has the identical gen_random_bytes(6) + restricted search_path
-- combination -- this one fires on INSERT into locations (Inventory's
-- "+ Add room"), so creating a new room was equally broken.
create or replace function public.generate_location_qr_code()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.qr_code is null then
    new.qr_code := 'LOC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  end if;
  return new;
end;
$function$;
