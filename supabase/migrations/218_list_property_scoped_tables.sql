-- 218_list_property_scoped_tables.sql
-- SS-326. Applied live 6 Aug 2026.
--
-- Backs the backup route's live table enumeration. Returns every base
-- table in public that carries a property_id column -- the same
-- criterion the route's own comment already stated (property_id column,
-- confirmed live), now enforced by a query instead of a hardcoded list
-- someone has to remember to update. The register's own count grew 44 ->
-- 45 -> 51 -> 47 across several sweeps the same night this was written,
-- as tables were added and the hand-kept list fell further behind each
-- time -- exactly the failure mode this migration closes.
--
-- SECURITY DEFINER because information_schema is not exposed to
-- PostgREST's anon/authenticated roles, and this is metadata ABOUT the
-- schema, not a row any property member should read through their own
-- session -- the backup route itself still gates on owner-only before
-- ever calling this.
create or replace function public.list_property_scoped_tables()
returns table(table_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t
    on t.table_name = c.table_name and t.table_schema = c.table_schema
  where c.table_schema = 'public'
    and c.column_name = 'property_id'
    and t.table_type = 'BASE TABLE'
  order by c.table_name;
$$;

revoke all on function public.list_property_scoped_tables() from anon, authenticated;
