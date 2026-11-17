import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionGenerator } from "@/lib/question_generator";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import type { LLMClient } from "@/services/resume/llm/LLMClient";

const mockContext = candidateContextSchema.parse({
  candidate: { full_name: "John Doe", country: null, city: null, current_status: "Software Engineer" },
  goals: { target_role: "Software Engineer", target_industry: "Technology", experience_level: "mid", target_companies: [], interview_type: "technical", difficulty: "medium", interview_language: "english", additional_notes: "Improve system design answers." },
  onboarding: {
    education: [],
    work_experience: [{
      job_title: "Frontend Engineer",
      company: "Example Corp",
      employment_type: "full-time",
      start_date: "2021-01",
      end_date: null,
      is_current: true,
      description: "Built accessible React applications.",
    }],
    skills: [{ name: "JavaScript", category: "technical", level: "advanced" }, { name: "React", category: "framework", level: "advanced" }],
    languages: [{ language: "English", proficiency: "native", is_interview_language: true }],
  },
  resume: { summary: "Senior frontend developer.", skills: { technical: ["JavaScript", "React"], soft: ["Communication"] }, experience: [], projects: [{ name: "Task Manager", tech_stack: ["React", "Node"], description: "A task management app" }], education: [], certifications: [], languages: [] },
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

function createGenerator() {
  const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
  return {
    llmClient,
    generator: new QuestionGenerator(llmClient, mockContext, mockConfig),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuestionGenerator", () => {
  it("has correct context", () => {
    expect(mockContext.candidate.full_name).toBe("John Doe");
  });

  it("has correct config", () => {
    expect(mockConfig.target_role).toBe("Software Engineer");
  });

  it("generator can be instantiated", () => {
    const generator = new QuestionGenerator(
      { generateJson: vi.fn() },
      mockContext,
      mockConfig,
    );
    expect(generator).toBeInstanceOf(QuestionGenerator);
  });

  it("normalizes an array of question strings and includes the context snapshot in the first-question prompt", async () => {
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson.mockResolvedValue(
      JSON.stringify({
        questions: ["Tell me about a project where you used JavaScript to solve a problem."],
      }),
    );

    const result = await generator.generateMainQuestion([], []);

    expect(result).toEqual({
      questionText: "Tell me about a project where you used JavaScript to solve a problem.",
      topic: "JavaScript",
      isFollowup: false,
      fallback: false,
    });
    const prompt = llmClient.generateJson.mock.calls[0]?.[0].prompt ?? "";
    expect(prompt).toContain("Target role from context_snapshot: Software Engineer");
    expect(prompt).toContain("Onboarding goals from context_snapshot");
    expect(prompt).toContain("Candidate skills: [\"JavaScript\",\"React\",\"Communication\"]");
    expect(prompt).toContain("Task Manager");
    expect(prompt).toContain("Frontend Engineer at Example Corp");
    expect(prompt).toContain('"type":"object","properties":{"questions"');
    expect(prompt).toContain('"text":"How did you apply object-oriented design in your Java project?"');
    expect(prompt).toContain('"topic":"Java OOP"}]}');
    expect(llmClient.generateJson.mock.calls[0]?.[0].systemInstruction).toContain(
      '"topic":"Java OOP"}]}',
    );
    expect(llmClient.generateJson.mock.calls[0]?.[0].jsonSchema).toMatchObject({
      type: "OBJECT",
      properties: { questions: { type: "ARRAY", maxItems: 1 } },
    });
  });

  it("normalizes object items and preserves their topic", async () => {
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson.mockResolvedValue(
      JSON.stringify({
        questions: [{ text: "How did you structure the React application for maintainability?", topic: "React architecture", type: "main" }],
      }),
    );

    await expect(generator.generateMainQuestion([], [])).resolves.toMatchObject({
      questionText: "How did you structure the React application for maintainability?",
      topic: "React architecture",
      fallback: false,
    });
  });

  it("derives a missing topic from a project when the candidate has no skills", async () => {
    const projectContext = candidateContextSchema.parse({
      ...mockContext,
      onboarding: { ...mockContext.onboarding, skills: [] },
      resume: mockContext.resume
        ? { ...mockContext.resume, skills: { technical: [], soft: [] } }
        : null,
    });
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    const generator = new QuestionGenerator(llmClient, projectContext, mockConfig);
    llmClient.generateJson.mockResolvedValue(
      '{"questions":[{"text":"Tell me how you delivered the Task Manager project."}]}',
    );

    await expect(generator.generateMainQuestion([], [])).resolves.toMatchObject({
      topic: "Task Manager",
      fallback: false,
    });
  });

  it("uses general when neither skills nor projects can provide a topic", async () => {
    const genericContext = candidateContextSchema.parse({
      ...mockContext,
      onboarding: { ...mockContext.onboarding, skills: [] },
      resume: null,
    });
    const llmClient = { generateJson: vi.fn<LLMClient["generateJson"]>() };
    const generator = new QuestionGenerator(llmClient, genericContext, mockConfig);
    llmClient.generateJson.mockResolvedValue(
      '{"questions":["Tell me about a recent challenge you solved at work."]}',
    );

    await expect(generator.generateMainQuestion([], [])).resolves.toMatchObject({
      topic: "general",
      fallback: false,
    });
  });

  it("extracts JSON from a fenced response with surrounding text", async () => {
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson.mockResolvedValue(
      'Here is the result:\n```json\n{"questions":[{"text":"Describe how you used React to improve an application.","topic":"React"}]}\n```\nHope this helps.',
    );

    await expect(generator.generateMainQuestion([], [])).resolves.toMatchObject({
      questionText: "Describe how you used React to improve an application.",
      topic: "React",
      fallback: false,
    });
  });

  it("retries once with the validation error and required format after invalid JSON", async () => {
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson
      .mockResolvedValueOnce("this is not JSON")
      .mockResolvedValueOnce(
        '{"questions":[{"text":"Tell me how you delivered the Task Manager project.","topic":"Task Manager"}]}',
      );

    const result = await generator.generateMainQuestion([], []);

    expect(result.fallback).toBe(false);
    expect(llmClient.generateJson).toHaveBeenCalledTimes(2);
    const correctionPrompt = llmClient.generateJson.mock.calls[1]?.[0].prompt ?? "";
    expect(correctionPrompt).toContain("failed validation");
    expect(correctionPrompt).toContain("required format exactly");
    expect(correctionPrompt).toContain("questions");
  });

  it("retries questions that fail the minimum-length validation", async () => {
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson
      .mockResolvedValueOnce('{"questions":["Why?"]}')
      .mockResolvedValueOnce(
        '{"questions":["Tell me about a technical challenge you solved at work."]}',
      );

    await expect(generator.generateMainQuestion([], [])).resolves.toMatchObject({
      fallback: false,
      topic: "JavaScript",
    });
    expect(llmClient.generateJson).toHaveBeenCalledTimes(2);
  });

  it("uses a general fallback after a failed retry and returns the fallback flag", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { generator, llmClient } = createGenerator();
    llmClient.generateJson
      .mockResolvedValueOnce('{"questions":[]}')
      .mockResolvedValueOnce('{"questions":[{"text":"Too short"}]}');

    const result = await generator.generateMainQuestion([], []);

    expect(result).toEqual({
      questionText: "Tell me about a project or experience relevant to the role.",
      topic: "general",
      isFollowup: false,
      fallback: true,
    });
    expect(llmClient.generateJson).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith(
      "QuestionGenerator failed; using general fallback",
      expect.objectContaining({ error: expect.objectContaining({ name: "ZodError" }) }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain("Task Manager");
  });
});
