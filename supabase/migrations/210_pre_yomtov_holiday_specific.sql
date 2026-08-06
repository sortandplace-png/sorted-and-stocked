-- 210_pre_yomtov_holiday_specific.sql
-- SS-066. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- Splits the single 'pre_yomtov' trigger into four holiday-specific ones.
-- The generic trigger fired on ANY approaching yom tov, so Rosh Hashana
-- tips could surface before Pesach and Sukkah tips before Shavuos.
--
-- Lead days differ on purpose and are not a tuning knob: Pesach is 21
-- because preparation genuinely starts three weeks out, Sukkos is 10,
-- Shavuos is 7.

insert into tip_trigger_rules (trigger_type, rule_kind, holiday_pattern, lead_days, notes)
values
 ('pre_rosh_hashana','yomtov_match','Erev Rosh Hashana%',14,
  'SS-066. Holiday specific. Rosh Hashana tips must not fire before Pesach or Sukkos.'),
 ('pre_sukkos','yomtov_match','Erev Sukkot%',10,
  'SS-066. Holiday specific. Sukkah tips are meaningless before any other yom tov.'),
 ('pre_pesach','yomtov_match','Erev Pesach%',21,
  'SS-066. Holiday specific. Longer lead because Pesach preparation genuinely starts earlier.'),
 ('pre_shavuos','yomtov_match','Erev Shavuot%',7,
  'SS-066. Holiday specific.')
on conflict do nothing;

-- Repoints the existing tips off the generic trigger. Only the rows that
-- are actually holiday specific move; anything still on 'pre_yomtov' is
-- generic on purpose.
update dashboard_tips set trigger_type = 'pre_rosh_hashana'
 where trigger_type = 'pre_yomtov' and id in ('PYT001','PYT002');

update dashboard_tips set trigger_type = 'pre_sukkos'
 where trigger_type = 'pre_yomtov' and id in ('PYT009','PYT010');
