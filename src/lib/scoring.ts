/**
 * Averages evaluated turn scores (0-10) and scales the result to 0-100.
 * Unanswered or malformed evaluations are ignored.
 */
export function calculateOverallScore(evaluations: readonly unknown[]): number | null {
  let total = 0;
  let count = 0;

  for (const evaluation of evaluations) {
    if (typeof evaluation !== "object" || evaluation === null || Array.isArray(evaluation)) {
      continue;
    }

    const score = Reflect.get(evaluation, "score");
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 10) {
      continue;
    }

    total += score;
    count += 1;
  }

  return count === 0 ? null : Math.round((total / count) * 10);
}
