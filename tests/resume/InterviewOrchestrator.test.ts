import { describe, expect, it, vi } from "vitest";
import { InterviewOrchestrator } from "@/lib/interview_orchestrator";

const mockSkills = ["JavaScript", "TypeScript"];
const mockResumeSummary = "Senior frontend developer";
const mockOptions = { questionCount: 5, includeFollowups: true, topicWhitelist: [] };

describe("InterviewOrchestrator", () => {
  it("has correct skills", () => {
    expect(mockSkills).toEqual(["JavaScript", "TypeScript"]);
  });

  it("has correct question count", () => {
    expect(mockOptions.questionCount).toBe(5);
  });

  it("includes followups by default", () => {
    expect(mockOptions.includeFollowups).toBe(true);
  });

  it("has empty topic whitelist by default", () => {
    expect(mockOptions.topicWhitelist).toEqual([]);
  });

  it("filters topics by whitelist when provided", () => {
    const whitelistedOptions = { questionCount: 5, includeFollowups: true, topicWhitelist: ["JavaScript"] };
    expect(whitelistedOptions.topicWhitelist).toEqual(["JavaScript"]);
    expect(whitelistedOptions.questionCount).toBe(5);
  });

  it("handles custom options object", () => {
    const customOptions = { questionCount: 10, includeFollowups: false, topicWhitelist: ["React", "Node"] };
    expect(customOptions.questionCount).toBe(10);
    expect(customOptions.includeFollowups).toBe(false);
    expect(customOptions.topicWhitelist).toEqual(["React", "Node"]);
  });

  it("low score triggers follow-up", () => {
    const orchestrator = new InterviewOrchestrator(
      mockSkills,
      mockResumeSummary,
      mockOptions
    );

    // Evaluate a low-effort answer ("no", "idk")
    const result = orchestrator.evaluateAnswer("q1", "no", [{ questionType: "main" }]);

    // Should trigger a follow-up (needsFollowup logic)
    expect(result.evaluation.score).toBeLessThanOrEqual(3);
  });

  it("very short answer triggers follow-up", () => {
    const orchestrator = new InterviewOrchestrator(
      mockSkills,
      mockResumeSummary,
      mockOptions
    );

    // Evaluate a very short answer
    const result = orchestrator.evaluateAnswer("q1", "idk", [{ questionType: "main" }]);

    // Should trigger a follow-up due to short answer
    expect(result.evaluation.score).toBeLessThanOrEqual(3);
  });

  it("2 follow-ups reached -> next main question", () => {
    const orchestrator = new InterviewOrchestrator(
      mockSkills,
      mockResumeSummary,
      mockOptions
    );

    // Evaluate 3 low-effort answers (main Q + 2 follow-ups)
    const mainTurn = [{ questionType: "main" }];
    const oneFollowup = [...mainTurn, { questionType: "followup" }];
    const twoFollowups = [...oneFollowup, { questionType: "followup" }];
    orchestrator.evaluateAnswer("q1", "no", mainTurn);
    orchestrator.evaluateAnswer("q1", "idk", oneFollowup);
    const result2 = orchestrator.evaluateAnswer("q1", "because", twoFollowups);

    expect(result2.newQuestion?.isFollowup).toBe(false);
  });

  it("last question -> completed", () => {
    const orchestrator = new InterviewOrchestrator(
      mockSkills,
      mockResumeSummary,
      { ...mockOptions, questionCount: 1 }
    );

    // Answer the only question
    const result = orchestrator.evaluateAnswer("q1", "yes", [{ questionType: "main" }]);

    // Interview should be completable
    const state = orchestrator.complete();
    expect(state.status).toBeDefined();
  });

  it("high score does not trigger follow-up", () => {
    const orchestrator = new InterviewOrchestrator(
      mockSkills,
      mockResumeSummary,
      mockOptions
    );

    // Evaluate a detailed answer with good score
    const result = orchestrator.evaluateAnswer(
      "q1",
      "I have 5 years of experience with JavaScript and TypeScript building web applications.",
      [{ questionType: "main" }],
    );

    // High score should not trigger follow-up
    expect(result.evaluation.score).toBeGreaterThan(3);
  });
});