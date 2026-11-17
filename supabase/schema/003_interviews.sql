-- Run this file once from the Supabase Dashboard SQL Editor after
-- 002_onboarding.sql. Safe to re-run: table, index, and policies are idempotent.

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (char_length(role) between 1 and 120),
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'abandoned')
  ),
  score numeric check (score is null or (score >= 0 and score <= 100)),
  created_at timestamptz not null default now()
);

-- Supports both "recent interviews for user" and per-user scans in either order.
create index if not exists interviews_user_id_created_at_idx
  on public.interviews (user_id, created_at desc);

alter table public.interviews enable row level security;

drop policy if exists "interviews_select_own" on public.interviews;
create policy "interviews_select_own" on public.interviews for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "interviews_insert_own" on public.interviews;
create policy "interviews_insert_own" on public.interviews for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "interviews_update_own" on public.interviews;
create policy "interviews_update_own" on public.interviews for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "interviews_delete_own" on public.interviews;
create policy "interviews_delete_own" on public.interviews for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.interviews to authenticated;
