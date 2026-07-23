-- SS-149: fast_days only had 2 of 6 real fast-day rows for 2027 (Yom
-- Kippur and 4 minor fasts entirely missing), and the 2 rows it did have
-- were both WRONG -- confirmed against Hebcal's own API (the same
-- authoritative source this app already trusts for Omer/Rosh Chodesh/major
-- holidays elsewhere in lib/calendar-trigger-type.ts), not assumed:
--   Ta'anit Esther 2027: table had 2027-03-18, Hebcal says 2027-03-22
--   Tisha B'Av 2027:     table had 2027-07-25, Hebcal says 2027-08-12
-- Same family of bug as the yom_tov_dates 2026/2027 corrections mentioned
-- in this project's own notes -- this table just never got the same pass.
--
-- date is this table's primary key, so the two wrong rows are corrected by
-- changing their date value in place (no FK references this table --
-- confirmed via pg_constraint before writing this).
update public.fast_days set date = '2027-03-22' where date = '2027-03-18' and holiday_name = 'Taanit Esther';
update public.fast_days set date = '2027-08-12' where date = '2027-07-25' and holiday_name = 'Tisha B''Av';

-- Previously entirely missing for 2027 (severities match this table's
-- existing convention: Yom Kippur/Tisha B'Av = major, the 4 others =
-- minor). Asara B'Tevet's own next real occurrence after the existing
-- 2026-12-20 row doesn't fall in 2027 at all -- 10 Tevet 5788 lands on the
-- Gregorian calendar in January 2028 -- so that row is dated 2028, not
-- 2027, on purpose.
insert into public.fast_days (date, holiday_name, severity, note) values
  ('2027-07-22', 'Tzom Tammuz', 'minor', 'Daytime-only fast, ends at nightfall (17 Tammuz -- begins the Three Weeks leading to Tisha B''Av). Same exemptions as other minor fasts.'),
  ('2027-10-04', 'Tzom Gedaliah', 'minor', 'Daytime-only fast, ends at nightfall. Dinner is fine. Children, pregnant/nursing women, and anyone with a medical exemption are generally not required to fast.'),
  ('2027-10-11', 'Yom Kippur', 'major', 'Full 25-hour fast. No meals during the fast itself -- only the pre-fast meal (before sunset the day before) and break-fast (after nightfall).'),
  ('2028-01-09', 'Asara B''Tevet', 'minor', 'Daytime-only fast, ends at nightfall. Same exemptions as other minor fasts.')
on conflict (date) do nothing;
