import { describe, expect, it, vi } from "vitest";
import { AnswerEvaluator } from "@/lib/answer_evaluator";
import {
  decideNextQuestionType,
  getConsecutiveFollowupCount,
  type InterviewQuestionTurn,
} from "@/lib/interview_followup";
import type { LLMClient } from "@/services/resume/llm/LLMClient";

function createEvaluator(client: LLMClient): AnswerEvaluator {
  return new AnswerEvaluator(client, null, null);
}

function evaluationResponse(score: number): string {
  return JSON.stringify({
    score,
    relevance: score,
    depth: score,
    clarity: score,
    strengths: [],
    gaps: [],
  });
}

describe("interview follow-up decisions", () => {
  it("allows a low-score answer to get a follow-up after the last main question", async () => {
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    llmClient.generateJson.mockResolvedValue(evaluationResponse(2));
    const answer = await createEvaluator(llmClient).evaluate("No.", "general");

    expect(
      decideNextQuestionType([{ questionType: "main" }], answer.score, "No.", 1)
        .nextQuestionType,
    ).toBe("followup");
  });

  it("does not give a long answer with a high LLM score a follow-up", async () => {
    const answerText = "A detailed answer. ".repeat(20);
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    llmClient.generateJson.mockResolvedValue(evaluationResponse(8));
    const answer = await createEvaluator(llmClient).evaluate(answerText, "general");

    expect(
      decideNextQuestionType(
        [{ questionType: "main" }],
        answer.score,
        answerText,
        2,
      ).nextQuestionType,
    ).toBe("main");
  });

  it("does not give a short correct answer with a high LLM score a follow-up", async () => {
    const answerText = "O(1) lookup using a HashMap";
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    llmClient.generateJson.mockResolvedValue(evaluationResponse(9));
    const answer = await createEvaluator(llmClient).evaluate(answerText, "general");

    expect(
      decideNextQuestionType(
        [{ questionType: "main" }],
        answer.score,
        answerText,
        2,
      ).nextQuestionType,
    ).toBe("main");
  });

  it("caps follow-ups at exactly two across fresh evaluators using persisted turn history", async () => {
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    llmClient.generateJson
      .mockResolvedValueOnce(evaluationResponse(2))
      .mockResolvedValueOnce(evaluationResponse(2))
      .mockResolvedValueOnce(evaluationResponse(2));
    const turns: InterviewQuestionTurn[] = [{ questionType: "main" }];
    const nextTypes: Array<"main" | "followup" | null> = [];

    for (let request = 0; request < 3; request += 1) {
      const answerText = "No.";
      const answer = await createEvaluator(llmClient).evaluate(answerText, "general");
      const decision = decideNextQuestionType(
        [...turns],
        answer.score,
        answerText,
        1,
      );
      nextTypes.push(decision.nextQuestionType);
      if (decision.nextQuestionType === "followup") {
        turns.push({ questionType: "followup" });
      }
    }

    expect(nextTypes).toEqual(["followup", "followup", null]);
    expect(getConsecutiveFollowupCount(turns)).toBe(2);
    expect(
      decideNextQuestionType(turns, 2, "No.", 2).nextQuestionType,
    ).toBe("main");
  });
});
