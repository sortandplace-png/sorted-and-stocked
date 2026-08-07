-- 227_guard_archiving_last_reachable_property.sql
-- SS-817. Applied live 6 Aug 2026.
--
-- Three documents said "never archive QA Demo" and it happened anyway
-- on 5 Aug, leaving demo@sortedandstocked.com (Apple App Review's
-- login) with six memberships and zero unarchived properties -- a
-- reviewer signing in would have landed on an empty picker. A note is
-- not a control; this makes the same class of mistake fail loudly at
-- the database instead of silently in the register.
--
-- GENERAL, not narrowly scoped to the demo account: refuses to set
-- archived_at on ANY property where doing so would leave ANY of its
-- members with zero unarchived property memberships. Scoped this way on
-- purpose -- the demo account is the instance that already happened, but
-- the same silent stranding could hit any account, and a rule that only
-- protects the one property already bitten is exactly the hand-kept
-- special case this project keeps failing on elsewhere.
--
-- Verified live before trusting this: archiving a property while a
-- member still has other unarchived properties succeeds (tested on Low,
-- with Blimie/sortandplace still holding 4 others); archiving a member's
-- LAST unarchived property is blocked (tested by attempting to archive
-- QA Demo as demo@'s sole remaining unarchived property) -- both in a
-- transaction, rolled back, nothing live changed by the test.
create or replace function public.guard_archiving_last_reachable_property()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stranded record;
begin
  -- Only fires on the NULL -> NOT NULL transition -- re-saving an
  -- already-archived property, or unarchiving, is never the mistake
  -- this guards against.
  if NEW.archived_at is not null and OLD.archived_at is null then
    select pm.user_id, u.email
      into v_stranded
      from property_members pm
      join auth.users u on u.id = pm.user_id
      where pm.property_id = NEW.id
        and not exists (
          select 1 from property_members pm2
          join properties p2 on p2.id = pm2.property_id
          where pm2.user_id = pm.user_id
            and p2.archived_at is null
            and p2.id <> NEW.id
        )
      limit 1;

    if found then
      raise exception
        'Cannot archive property % (%): % would be left with zero unarchived properties. If this account genuinely no longer needs a property, remove its membership first -- do not archive the property out from under it.',
        NEW.id, NEW.name, v_stranded.email;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_guard_archiving_last_reachable_property on public.properties;
create trigger trg_guard_archiving_last_reachable_property
  before update of archived_at on public.properties
  for each row execute function public.guard_archiving_last_reachable_property();

comment on function public.guard_archiving_last_reachable_property() is
  'SS-817. Refuses to archive a property that would leave any of its members with zero unarchived properties. Built after demo@sortedandstocked.com (Apple App Review) was stranded this way on 5 Aug despite three documents saying not to -- a note was not a control, this is.';
