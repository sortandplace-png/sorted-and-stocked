-- 167_property_calendar_layers.sql
-- SS-469: which calendar layers a property's month grid shows, mirroring
-- the tip_sets pattern. jewish = Shabbos/candles/yom tov/fasts;
-- civil = US federal holidays (pure date rules, SS-467); household
-- reserved for future property events. Henderson is a non-Jewish
-- household and sees a plain American calendar; Lax/Main/Country/Low
-- keep the default {jewish,civil}.
alter table properties add column calendar_layers text[] not null default '{jewish,civil}';

comment on column properties.calendar_layers is
  'SS-469: calendar layers shown on the month grid: jewish | civil | household. Mirrors tip_sets.';

update properties set calendar_layers = '{civil}' where name = 'Henderson';
