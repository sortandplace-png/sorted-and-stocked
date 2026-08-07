-- 225_fix_current_date_defaults.sql
-- SS-208. Applied live 6 Aug 2026.
--
-- Signature defaults first -- these can't be fixed at the call site at
-- all, only here, since a caller that omits p_date entirely falls
-- through to whatever the signature itself defaults to.

create or replace function public.is_tip_trigger_active(p_trigger text, p_date date DEFAULT public.eastern_today())
returns boolean
language plpgsql
stable
set search_path to 'public'
as $function$
DECLARE
  r         public.tip_trigger_rules%ROWTYPE;
  pat       text;
  hit       boolean := false;
  omer_from date;
  omer_to   date;
BEGIN
  SELECT * INTO r FROM public.tip_trigger_rules WHERE trigger_type = p_trigger;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF r.rule_kind IN ('evergreen','cadence') THEN
    RETURN true;

  ELSIF r.rule_kind = 'unresolvable' THEN
    RETURN false;

  ELSIF r.rule_kind = 'shabbos' THEN
    RETURN EXTRACT(dow FROM p_date) IN (5,6);

  ELSIF r.rule_kind = 'gregorian_months' THEN
    IF r.month_start <= r.month_end THEN
      RETURN EXTRACT(month FROM p_date) BETWEEN r.month_start AND r.month_end;
    ELSE
      RETURN EXTRACT(month FROM p_date) >= r.month_start
          OR EXTRACT(month FROM p_date) <= r.month_end;
    END IF;

  ELSIF r.rule_kind = 'fast_day' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.fast_days f
      WHERE p_date BETWEEN f.date - r.lead_days AND f.date
    );

  ELSIF r.rule_kind = 'nine_days' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.nine_days_windows w
      WHERE p_date BETWEEN w.start_date AND w.end_date
    );

  ELSIF r.rule_kind = 'omer' THEN
    SELECT max(date) INTO omer_from
      FROM public.jewish_calendar_dates(p_date - 90, p_date)
     WHERE holiday_name = 'Pesach II';
    SELECT min(date) INTO omer_to
      FROM public.jewish_calendar_dates(p_date, p_date + 90)
     WHERE holiday_name = 'Shavuot I';
    RETURN omer_from IS NOT NULL AND omer_to IS NOT NULL
       AND p_date BETWEEN omer_from AND omer_to;

  ELSIF r.rule_kind = 'yomtov_match' THEN
    FOREACH pat IN ARRAY string_to_array(coalesce(r.holiday_pattern,''), '|') LOOP
      IF EXISTS (
        SELECT 1 FROM public.jewish_calendar_dates(p_date, p_date + r.lead_days) y
        WHERE y.holiday_name LIKE pat
          AND p_date BETWEEN y.date - r.lead_days AND y.date
      ) THEN
        hit := true;
      END IF;
    END LOOP;
    RETURN hit;
  END IF;

  RETURN false;
END;
$function$;

create or replace function public.get_dashboard_tips(p_property_id uuid, p_date date DEFAULT public.eastern_today())
returns table(id text, trigger_type text, rule_kind text, audience text, title_en text, title_es text, body_en text, body_es text)
language sql
stable
set search_path to 'public'
as $function$
  SELECT t.id, t.trigger_type, r.rule_kind, t.audience,
         t.title_en, t.title_es, t.body_en, t.body_es
  FROM public.dashboard_tips t
  JOIN public.tip_trigger_rules r ON r.trigger_type = t.trigger_type
  JOIN public.properties p        ON p.id = p_property_id
  WHERE t.status = 'active'
    AND t.audience = ANY (coalesce(p.tip_sets, ARRAY[]::text[]))
    AND public.is_tip_trigger_active(t.trigger_type, p_date)
  ORDER BY t.trigger_type, t.id;
$function$;
