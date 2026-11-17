export const MAX_FOLLOWUPS_PER_MAIN_QUESTION = 2;

export type InterviewQuestionTurn = {
  readonly questionType: string;
};

export type NextQuestionType = "main" | "followup" | null;

export function getConsecutiveFollowupCount(
  turns: readonly InterviewQuestionTurn[],
): number {
  let lastMainQuestionIndex = -1;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index]?.questionType === "main") {
      lastMainQuestionIndex = index;
      break;
    }
  }

  return turns
    .slice(lastMainQuestionIndex + 1)
    .filter((turn) => turn.questionType === "followup").length;
}

export function decideNextQuestionType(
  turns: readonly InterviewQuestionTurn[],
  score: number,
  answerText: string,
  questionCount: number,
): {
  readonly needsFollowup: boolean;
  readonly followupCount: number;
  readonly nextQuestionType: NextQuestionType;
} {
  const consecutiveFollowupCount = getConsecutiveFollowupCount(turns);
  const needsFollowup =
    score <= 3 || (score < 5 && answerText.length < 20);
  const mainQuestionCount = turns.filter(
    (turn) => turn.questionType === "main",
  ).length;
  const nextQuestionType =
    needsFollowup &&
    consecutiveFollowupCount < MAX_FOLLOWUPS_PER_MAIN_QUESTION
      ? "followup"
      : mainQuestionCount < questionCount
        ? "main"
        : null;

  return {
    needsFollowup: nextQuestionType === "followup",
    followupCount:
      consecutiveFollowupCount +
      (nextQuestionType === "followup" ? 1 : 0),
    nextQuestionType,
  };
}
