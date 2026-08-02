-- 172: first property-scoped procedure (Tineco ruling, 2 Aug midnight).
-- sop_library has always been global -- no property_id, every house sees
-- all 104 procedures. Ruled: Tineco machines exist at Lax and Low ONLY, so
-- SOP-083 (Tineco Dirty Water Tank -- Rinse & Reset) must surface only
-- there. Rather than forking the table into per-property copies (the
-- SS-437-class hazard), a nullable scope array keeps the global model as
-- the default:
--   property_scope IS NULL  -> global, visible to every property (all 103
--                              other rows keep this)
--   property_scope = {ids}  -> visible only at those properties
-- Browse surfaces (HandbookTabs, SopLibraryClient, StaffTasksClient's
-- library fetch) filter on it; task-embedded SOP reads stay unfiltered
-- because master_tasks/staff_tasks are already property-scoped and the
-- single Tineco task lives on Low (verified, untouched).

alter table sop_library add column if not exists property_scope uuid[];

comment on column sop_library.property_scope is
  'NULL = global (every property). Array of property ids = procedure surfaces only at those properties. First use: SOP-083 scoped to Lax + Low (Tineco ruling, 2 Aug 2026).';

update sop_library
set property_scope = (select array_agg(id) from properties where name in ('Lax', 'Low'))
where sop_code = 'SOP-083'
  and (select count(*) from properties where name in ('Lax', 'Low')) = 2;
