-- Backfill completed interviews created before turn scores were stored in
-- interviews.overall_score. Safe to re-run; existing scores are preserved.

update public.interviews as interview
set overall_score = (
  select round(avg(evaluation.score) * 10)
  from (
    select case
      when jsonb_typeof(turn.evaluation -> 'score') = 'number' then
        case
          when (turn.evaluation ->> 'score')::numeric between 0 and 10
            then (turn.evaluation ->> 'score')::numeric
          else null
        end
      else null
    end as score
    from public.interview_turns as turn
    where turn.interview_id = interview.id
  ) as evaluation
  where evaluation.score is not null
)
where interview.status = 'completed'
  and interview.overall_score is null;
