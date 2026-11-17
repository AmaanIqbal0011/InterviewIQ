import { describe, expect, it, vi } from "vitest";
import { AnswerEvaluator } from "@/lib/answer_evaluator";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import type { LLMClient } from "@/services/resume/llm/LLMClient";

const mockContext = candidateContextSchema.parse({
  candidate: { full_name: "John Doe", country: null, city: null, current_status: "Software Engineer" },
  goals: { target_role: "Software Engineer", target_industry: null, experience_level: "mid", target_companies: [], interview_type: "technical", difficulty: "medium", interview_language: "english", additional_notes: null },
  onboarding: { education: [], work_experience: [], skills: [{ name: "JavaScript", category: "technical", level: "advanced" }, { name: "TypeScript", category: "technical", level: "advanced" }], languages: [{ language: "English", proficiency: "native", is_interview_language: true }] },
  resume: { summary: "Senior frontend developer.", skills: { technical: ["JavaScript", "TypeScript"], soft: ["Communication"] }, experience: [], projects: [], education: [], certifications: [], languages: [] },
  has_completed_resume: true,
});

const mockConfig = interviewConfigSchema.parse({
  target_role: "Software Engineer",
  experience_level: "mid",
  interview_type: "technical",
  difficulty: "medium",
  question_count: "5",
  interview_language: "english",
  focus_topics: [],
  use_resume: true,
});

// Mock the LLMClient - working pattern
vi.mock("@/services/resume/llm/LLMClient", () => ({
  LLMClient: class {
    generateJson = vi.fn();
    constructor() {}
  },
}));

describe("AnswerEvaluator", () => {
  it("has correct context", () => {
    expect(mockContext.candidate.full_name).toBe("John Doe");
  });

  it("has correct config", () => {
    expect(mockConfig.target_role).toBe("Software Engineer");
  });

  it("evaluator can be instantiated", () => {
    const evaluator = new AnswerEvaluator(
      {} as LLMClient,
      mockContext,
      mockConfig
    );
    expect(evaluator).toBeInstanceOf(AnswerEvaluator);
  });
});