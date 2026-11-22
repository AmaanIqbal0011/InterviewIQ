-- Report generation now reads the whole transcript plus how long the session
-- actually ran, and writes a short narrative summary.
-- Safe to re-run: every statement is idempotent.

alter table public.interview_reports
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists summary text;

comment on column public.interview_reports.duration_seconds is
  'Whole seconds the candidate actually spent in the session (capped at the configured duration).';
comment on column public.interview_reports.summary is
  'Short narrative overview of the session, written by the report generator.';
