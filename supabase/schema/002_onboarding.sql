-- Run this file once from the Supabase Dashboard SQL Editor after the project
-- is created. It is safe to re-run: tables, indexes, functions, and triggers
-- are created idempotently; RLS policies are replaced with their current form.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  country text check (country is null or char_length(country) <= 80),
  city text check (city is null or char_length(city) <= 80),
  current_status text check (
    current_status is null or current_status in (
      'student', 'working_professional', 'fresher', 'career_switcher', 'other'
    )
  ),
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects created from an older revision of this schema have a stricter
-- profiles table (country NOT NULL, current_status defaulted). The auth
-- trigger and the backfill below insert only (id, full_name), so align the
-- live table with this file. Each statement is a no-op when already matched.
alter table public.profiles alter column country drop not null;
alter table public.profiles alter column city drop not null;
alter table public.profiles alter column current_status drop not null;
alter table public.profiles alter column current_status drop default;

create table if not exists public.education_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('high_school', 'diploma', 'bachelors', 'masters', 'phd', 'other')),
  institution text not null check (char_length(institution) between 1 and 160),
  field_of_study text check (field_of_study is null or char_length(field_of_study) <= 120),
  start_year integer not null check (start_year between 1900 and 2200),
  end_year integer check (end_year is null or end_year between 1900 and 2200),
  is_current boolean not null default false,
  grade text check (grade is null or char_length(grade) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_year is null or end_year >= start_year)
);

-- Existing installations may still have the original constraint that required
-- ongoing education entries to have a null end year.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.education_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%is_current%'
      and pg_get_constraintdef(oid) like '%end_year%'
  loop
    execute format('alter table public.education_entries drop constraint %I', constraint_record.conname);
  end loop;
end
$$;

create table if not exists public.work_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_title text not null check (char_length(job_title) between 1 and 120),
  company text not null check (char_length(company) between 1 and 160),
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'contract', 'internship', 'other')
  ),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check ((is_current and end_date is null) or (not is_current and end_date is not null))
);

create table if not exists public.language_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null check (char_length(language) between 1 and 50),
  proficiency text not null check (proficiency in ('basic', 'conversational', 'fluent', 'native')),
  is_interview_language boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  category text not null check (category in ('technical', 'soft', 'tool')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_role text not null check (char_length(target_role) between 1 and 120),
  target_industry text check (target_industry is null or char_length(target_industry) <= 120),
  experience_level text not null check (experience_level in ('entry', 'junior', 'mid', 'senior')),
  target_companies text[] not null default '{}',
  interview_type text not null check (interview_type in ('technical', 'behavioral', 'mixed', 'hr')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  interview_language text not null check (char_length(interview_language) between 1 and 50),
  additional_notes text check (additional_notes is null or char_length(additional_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(target_companies) <= 10)
);

create index if not exists education_entries_user_id_idx on public.education_entries (user_id);
create index if not exists work_experiences_user_id_idx on public.work_experiences (user_id);
create index if not exists language_skills_user_id_idx on public.language_skills (user_id);
create index if not exists skills_user_id_idx on public.skills (user_id);

alter table public.profiles enable row level security;
alter table public.education_entries enable row level security;
alter table public.work_experiences enable row level security;
alter table public.language_skills enable row level security;
alter table public.skills enable row level security;
alter table public.career_goals enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "education_select_own" on public.education_entries;
create policy "education_select_own" on public.education_entries for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "education_insert_own" on public.education_entries;
create policy "education_insert_own" on public.education_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "education_update_own" on public.education_entries;
create policy "education_update_own" on public.education_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "education_delete_own" on public.education_entries;
create policy "education_delete_own" on public.education_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "work_select_own" on public.work_experiences;
create policy "work_select_own" on public.work_experiences for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "work_insert_own" on public.work_experiences;
create policy "work_insert_own" on public.work_experiences for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "work_update_own" on public.work_experiences;
create policy "work_update_own" on public.work_experiences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "work_delete_own" on public.work_experiences;
create policy "work_delete_own" on public.work_experiences for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "languages_select_own" on public.language_skills;
create policy "languages_select_own" on public.language_skills for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "languages_insert_own" on public.language_skills;
create policy "languages_insert_own" on public.language_skills for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "languages_update_own" on public.language_skills;
create policy "languages_update_own" on public.language_skills for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "languages_delete_own" on public.language_skills;
create policy "languages_delete_own" on public.language_skills for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "skills_select_own" on public.skills;
create policy "skills_select_own" on public.skills for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "skills_insert_own" on public.skills;
create policy "skills_insert_own" on public.skills for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "skills_update_own" on public.skills;
create policy "skills_update_own" on public.skills for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "skills_delete_own" on public.skills;
create policy "skills_delete_own" on public.skills for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "career_goals_select_own" on public.career_goals;
create policy "career_goals_select_own" on public.career_goals for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "career_goals_insert_own" on public.career_goals;
create policy "career_goals_insert_own" on public.career_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "career_goals_update_own" on public.career_goals;
create policy "career_goals_update_own" on public.career_goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "career_goals_delete_own" on public.career_goals;
create policy "career_goals_delete_own" on public.career_goals for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.education_entries to anon, authenticated;
grant select, insert, update, delete on public.work_experiences to anon, authenticated;
grant select, insert, update, delete on public.language_skills to anon, authenticated;
grant select, insert, update, delete on public.skills to anon, authenticated;
grant select, insert, update, delete on public.career_goals to anon, authenticated;

-- Accounts created before this schema (or before the auth trigger below) have
-- no profile row; backfill them so reads don't fail with not_found.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists education_entries_set_updated_at on public.education_entries;
create trigger education_entries_set_updated_at before update on public.education_entries
  for each row execute function public.set_updated_at();
drop trigger if exists work_experiences_set_updated_at on public.work_experiences;
create trigger work_experiences_set_updated_at before update on public.work_experiences
  for each row execute function public.set_updated_at();
drop trigger if exists language_skills_set_updated_at on public.language_skills;
create trigger language_skills_set_updated_at before update on public.language_skills
  for each row execute function public.set_updated_at();
drop trigger if exists skills_set_updated_at on public.skills;
create trigger skills_set_updated_at before update on public.skills
  for each row execute function public.set_updated_at();
drop trigger if exists career_goals_set_updated_at on public.career_goals;
create trigger career_goals_set_updated_at before update on public.career_goals
  for each row execute function public.set_updated_at();
