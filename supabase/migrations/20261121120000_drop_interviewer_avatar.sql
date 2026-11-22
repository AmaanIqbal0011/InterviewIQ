-- Remove the interviewer avatar preference added in
-- 20261121003000_simplify_onboarding_four_steps.sql.
-- The app no longer selects or inserts career_goals.interviewer_avatar.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.career_goals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%interviewer_avatar%'
  loop
    execute format('alter table public.career_goals drop constraint %I', constraint_record.conname);
  end loop;
end
$$;

alter table public.career_goals
  drop column if exists interviewer_avatar;
