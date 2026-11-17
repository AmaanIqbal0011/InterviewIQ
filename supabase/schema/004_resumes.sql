-- Run this file once from the Supabase Dashboard SQL Editor after
-- 003_interviews.sql. It is safe to re-run: the bucket, tables, indexes,
-- triggers, and policies are created idempotently.

-- ---------------------------------------------------------------------------
-- Storage: private bucket for resumes. Every object lives under
-- "<user_id>/<file>", and the storage policies below only allow a signed-in
-- user to touch objects in their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resume_files_select_own" on storage.objects;
create policy "resume_files_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "resume_files_insert_own" on storage.objects;
create policy "resume_files_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "resume_files_update_own" on storage.objects;
create policy "resume_files_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "resume_files_delete_own" on storage.objects;
create policy "resume_files_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null check (char_length(file_path) between 1 and 512),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  size bigint not null check (size > 0 and size <= 5242880),
  created_at timestamptz not null default now()
);

-- Supports "latest resume for user" without scanning the table.
create index if not exists resumes_user_id_created_at_idx
  on public.resumes (user_id, created_at desc);

alter table public.resumes enable row level security;

drop policy if exists "resumes_select_own" on public.resumes;
create policy "resumes_select_own" on public.resumes for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "resumes_insert_own" on public.resumes;
create policy "resumes_insert_own" on public.resumes for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "resumes_update_own" on public.resumes;
create policy "resumes_update_own" on public.resumes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "resumes_delete_own" on public.resumes;
create policy "resumes_delete_own" on public.resumes for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.resumes to authenticated;

create table if not exists public.resume_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  raw_text text,
  parsed jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One parsed profile per resume, so re-running parsing updates in place.
  unique (resume_id)
);

create index if not exists resume_profiles_user_id_idx
  on public.resume_profiles (user_id);

alter table public.resume_profiles enable row level security;

drop policy if exists "resume_profiles_select_own" on public.resume_profiles;
create policy "resume_profiles_select_own" on public.resume_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "resume_profiles_insert_own" on public.resume_profiles;
create policy "resume_profiles_insert_own" on public.resume_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "resume_profiles_update_own" on public.resume_profiles;
create policy "resume_profiles_update_own" on public.resume_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "resume_profiles_delete_own" on public.resume_profiles;
create policy "resume_profiles_delete_own" on public.resume_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.resume_profiles to authenticated;

-- set_updated_at() is defined in 002_onboarding.sql.
drop trigger if exists resume_profiles_set_updated_at on public.resume_profiles;
create trigger resume_profiles_set_updated_at before update on public.resume_profiles
  for each row execute function public.set_updated_at();
