-- Simplify onboarding to four steps while preserving completed onboarding users.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step integer not null default 1;

update public.profiles
set onboarding_step = least(onboarding_step, 4)
where onboarding_completed = false;

update public.profiles
set onboarding_step = 4
where onboarding_completed = true
  and onboarding_step > 4;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%onboarding_step%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_record.conname);
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step between 1 and 4);

alter table public.education_entries
  alter column start_year drop not null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.education_entries'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) like '%start_year%'
        or pg_get_constraintdef(oid) like '%end_year%'
      )
  loop
    execute format('alter table public.education_entries drop constraint %I', constraint_record.conname);
  end loop;
end
$$;

alter table public.education_entries
  add constraint education_entries_optional_start_year_check
  check (start_year is null or start_year between 1900 and 2200),
  add constraint education_entries_optional_end_year_check
  check (end_year is null or end_year between 1900 and 2200),
  add constraint education_entries_optional_year_order_check
  check (
    end_year is null
    or start_year is null
    or end_year >= start_year
  );

alter table public.career_goals
  add column if not exists interviewer_avatar text not null default 'female'
    check (interviewer_avatar in ('female', 'male')),
  add column if not exists practice_goals text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.career_goals'::regclass
      and conname = 'career_goals_practice_goals_max_check'
  ) then
    alter table public.career_goals
      add constraint career_goals_practice_goals_max_check
      check (cardinality(practice_goals) <= 3);
  end if;
end
$$;
