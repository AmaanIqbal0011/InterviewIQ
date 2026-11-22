alter table public.profiles
  alter column full_name set default '',
  alter column country drop not null,
  alter column city drop not null,
  alter column current_status drop not null,
  alter column current_status drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_full_name text;
begin
  profile_full_name := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      ''
    ),
    80
  );

  insert into public.profiles (
    id,
    full_name,
    onboarding_completed,
    onboarding_step,
    created_at,
    updated_at
  )
  values (
    new.id,
    profile_full_name,
    false,
    1,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.profiles
set full_name = left(coalesce(split_part(u.email, '@', 1), ''), 80)
from auth.users u
where u.id = profiles.id
  and profiles.full_name is null;

insert into public.profiles (
  id,
  full_name,
  onboarding_completed,
  onboarding_step,
  created_at,
  updated_at
)
select
  u.id,
  left(
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      split_part(u.email, '@', 1),
      ''
    ),
    80
  ),
  false,
  1,
  now(),
  now()
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
)
on conflict (id) do nothing;