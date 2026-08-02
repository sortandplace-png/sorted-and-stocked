-- 174: SS-436 reopen, defect 1 (names). Two problems, one root:
-- profiles.full_name was empty for real humans and nothing could fall back,
-- because email lives only in auth.users where no client can read it.
--
-- (a) profiles.email, synced from auth.users by trigger. Every surface that
--     joins profiles can now fall back to email instead of a placeholder --
--     the string "Unnamed" is banned from the UI by ruling. Team page
--     already shows emails to owner/manager via the admin route; this
--     extends the same information to co-members of a property (the only
--     people who can read each other's profiles rows), which is the ruled
--     behavior.
-- (b) set_member_full_name(): Racquel maintains display names from the
--     Team page. profiles updates are self-only under RLS, so this is a
--     SECURITY DEFINER RPC gated on the caller being an owner/manager of a
--     property the target belongs to.

alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert, not update: on brand-new signups this trigger can fire before
  -- (or without) the profile-creation trigger, and the email must not be
  -- lost to ordering.
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end
$$;

drop trigger if exists sync_profile_email on auth.users;
create trigger sync_profile_email
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();

create or replace function public.set_member_full_name(target_user uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if btrim(coalesce(new_name, '')) = '' then
    raise exception 'Name cannot be empty';
  end if;
  if not exists (
    select 1
    from property_members caller
    join property_members target on target.property_id = caller.property_id
    where caller.user_id = auth.uid()
      and caller.role in ('owner', 'manager')
      and target.user_id = target_user
  ) then
    raise exception 'Only an owner or manager of a shared property can rename a member';
  end if;
  update profiles set full_name = btrim(new_name) where id = target_user;
end
$$;

grant execute on function public.set_member_full_name(uuid, text) to authenticated;
