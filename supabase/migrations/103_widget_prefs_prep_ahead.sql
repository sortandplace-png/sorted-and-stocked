-- Dashboard widget restructure: Low Stock Alerts moves out of the
-- toggleable widget-prefs system (it becomes a fixed, always-shown row
-- paired with a new Shopping List summary) and Prep Ahead Assistant moves
-- in to take its place. Shabbos/Yom Tov Countdown is dropped entirely --
-- it duplicated the observance pill already shown in the property header
-- on every page (app/properties/[id]/layout.tsx).
--
-- Carries forward each user's existing show/hide + order preference rather
-- than silently resetting it: a user who had hidden "Low Stock Alerts"
-- keeps that same hidden state, now applied to "Prep Ahead Assistant" in
-- the same widget slot.
update public.dashboard_widget_prefs
set widget_key = 'prep_ahead'
where widget_key = 'low_stock_alerts';

delete from public.dashboard_widget_prefs
where widget_key = 'holiday_countdown';
