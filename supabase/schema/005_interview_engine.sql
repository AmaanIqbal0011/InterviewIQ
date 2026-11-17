-- Run this file once from the Supabase Dashboard SQL Editor after
-- 004_resumes.sql. Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. Extend `interviews` with the engine columns.
-- ---------------------------------------------------------------------------
alter table public.interviews
  add column if not exists config jsonb,
  add column if not exists context_snapshot jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists overall_score numeric check (
    overall_score is null or (overall_score >= 0 and overall_score <= 100)
  ),
  add column if not exists report_status text not null default 'pending' check (
    report_status in ('pending', 'generating', 'ready', 'failed')
  );

-- Carry legacy scores into overall_score before retiring the old column.
update public.interviews
  set overall_score = score
  where overall_score is null and score is not null;

alter table public.interviews drop column if exists score;

-- The engine starts every session in `setup` before question 1 exists.
alter table public.interviews drop constraint if exists interviews_status_check;
alter table public.interviews add constraint interviews_status_check
  check (status in ('setup', 'in_progress', 'completed', 'abandoned'));
alter table public.interviews alter column status set default 'setup';

-- ---------------------------------------------------------------------------
-- 2. One row per AI question asked (main or follow-up) plus the answer.
--    The unique (interview_id, turn_index) pair makes "insert the next turn"
--    idempotent under double-submits and concurrent requests.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  question_type text not null check (question_type in ('main', 'followup')),
  question_text text not null check (char_length(question_text) between 1 and 4000),
  topic text check (topic is null or char_length(topic) <= 120),
  answer_text text check (answer_text is null or char_length(answer_text) <= 3000),
  evaluation jsonb,
  created_at timestamptz not null default now(),
  unique (interview_id, turn_index)
);

create index if not exists interview_turns_interview_id_idx
  on public.interview_turns (interview_id, turn_index);

alter table public.interview_turns enable row level security;

drop policy if exists "interview_turns_select_own" on public.interview_turns;
create policy "interview_turns_select_own" on public.interview_turns for select to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())
  ));
drop policy if exists "interview_turns_insert_own" on public.interview_turns;
create policy "interview_turns_insert_own" on public.interview_turns for insert to authenticated
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())
  ));
drop policy if exists "interview_turns_update_own" on public.interview_turns;
create policy "interview_turns_update_own" on public.interview_turns for update to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())
  ));
drop policy if exists "interview_turns_delete_own" on public.interview_turns;
create policy "interview_turns_delete_own" on public.interview_turns for delete to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.interview_turns to authenticated;

-- ---------------------------------------------------------------------------
-- 3. One report per interview. Narrative fields are LLM-written; scores are
--    computed in code (ScoreCalculator) and stored as numbers.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_reports (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  overall_score numeric not null check (overall_score >= 0 and overall_score <= 100),
  category_scores jsonb not null,
  strengths jsonb not null,
  weaknesses jsonb not null,
  question_feedback jsonb not null,
  improvement_plan jsonb not null,
  cv_insights jsonb not null,
  created_at timestamptz not null default now()
);

-- Idempotent report generation: a second concurrent attempt conflicts here
-- instead of producing a duplicate row.
create unique index if not exists interview_reports_interview_id_key
  on public.interview_reports (interview_id);
create index if not exists interview_reports_user_id_idx
  on public.interview_reports (user_id, created_at desc);

alter table public.interview_reports enable row level security;

drop policy if exists "interview_reports_select_own" on public.interview_reports;
create policy "interview_reports_select_own" on public.interview_reports for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "interview_reports_insert_own" on public.interview_reports;
create policy "interview_reports_insert_own" on public.interview_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "interview_reports_update_own" on public.interview_reports;
create policy "interview_reports_update_own" on public.interview_reports for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "interview_reports_delete_own" on public.interview_reports;
create policy "interview_reports_delete_own" on public.interview_reports for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.interview_reports to authenticated;
