import { describe, expect, it } from "vitest";
import { InterviewPromptBuilder } from "@/services/interview/InterviewPromptBuilder";
import { InterviewTimer } from "@/services/interview/InterviewTimer";
import { InterviewerPersona } from "@/services/interview/InterviewerPersona";
import { CandidateProfile } from "@/services/interview/CandidateProfile";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";

const START = "2026-01-01T10:00:00.000Z";

const config = interviewConfigSchema.parse({
  target_role: "Frontend Engineer",
  experience_level: "mid",
  interview_type: "technical",
  difficulty: "medium",
  duration_minutes: "5",
  interview_language: "english",
  focus_topics: ["React"],
  use_resume: true,
});

const context = candidateContextSchema.parse({
  candidate: { full_name: "Ada Lovelace", country: null, city: null, current_status: "Student" },
  goals: {
    target_role: "Frontend Engineer",
    target_industry: null,
    experience_level: "mid",
    target_companies: [],
    interview_type: "technical",
    difficulty: "medium",
    interview_language: "english",
    practice_goals: [],
    additional_notes: null,
  },
  onboarding: {
    education: [],
    work_experience: [],
    skills: [{ name: "React", category: "technical", level: "advanced" }],
    languages: [{ language: "English", proficiency: "native", is_interview_language: true }],
  },
  resume: null,
  has_completed_resume: false,
});

function builder() {
  return new InterviewPromptBuilder({ outputContract: '{"move":"question","text":"..."}' });
}

function timerAt(secondsAfterStart: number, openingComplete = true) {
  return new InterviewTimer({
    durationSeconds: 300,
    startedAt: START,
    nowMs: Date.parse(START) + secondsAfterStart * 1000,
    openingComplete,
  });
}

function contextFor(phase: "OPENING" | "MAIN" | "WRAP_UP" | "ENDED", seconds = 10) {
  const timer = timerAt(seconds, phase !== "OPENING");
  return {
    persona: InterviewerPersona.forInterview(config),
    profile: CandidateProfile.fromContext(context),
    timer,
    config,
    coveredTopics: ["React"],
    history: [{ move: "open" as const, question: "Tell me about yourself.", answer: "I build things." }],
    phase,
  };
}

describe("InterviewPromptBuilder.allowedMoves", () => {
  it("only lets the opening greet and ask the opener", () => {
    expect(builder().allowedMoves("OPENING")).toEqual(["open"]);
  });

  it("keeps the main phase to questions and probes", () => {
    expect(builder().allowedMoves("MAIN")).toEqual(["probe", "question"]);
  });

  it("stops new topics in wrap-up and only allows the closer at the end", () => {
    expect(builder().allowedMoves("WRAP_UP")).toEqual(["wrap_up", "closing"]);
    expect(builder().allowedMoves("ENDED")).toEqual(["closing"]);
  });
});

describe("InterviewPromptBuilder.buildSystemPrompt", () => {
  it("injects the remaining time, phase and session length", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN", 120));

    expect(prompt).toContain("Session length: 5 minutes.");
    expect(prompt).toContain("Time left:");
    expect(prompt).toContain("3 minutes remaining");
    expect(prompt).toContain("Current phase: MAIN.");
  });

  it("uses the turn phase rather than the timer's phase", () => {
    // Timer still says MAIN (120s left) but the session forces the closer.
    const prompt = builder().buildSystemPrompt(contextFor("ENDED", 120));

    expect(prompt).toContain("Current phase: ENDED.");
    expect(prompt).toContain("time is up");
  });

  it("includes the candidate profile, persona and target role", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN"));

    expect(prompt).toContain("Ada Lovelace");
    expect(prompt).toContain("Target role: Frontend Engineer.");
    expect(prompt).toContain("=== CANDIDATE ===");
  });

  it("covers one question at a time and forbids numbering", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN"));

    expect(prompt).toContain("Ask exactly ONE question per message.");
    expect(prompt).toContain('Never say "question 3"');
  });

  it("lists the topics already covered so nothing repeats", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN"));
    expect(prompt).toContain("=== TOPICS ALREADY COVERED ===");
    expect(prompt).toContain("React");
  });

  it("carries the conversation history into the prompt", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN"));
    expect(prompt).toContain("Tell me about yourself.");
    expect(prompt).toContain("I build things.");
  });

  it("appends the injected output contract", () => {
    const prompt = builder().buildSystemPrompt(contextFor("MAIN"));
    expect(prompt).toContain('{"move":"question","text":"..."}');
  });
});

describe("InterviewPromptBuilder.buildUserPrompt", () => {
  it("quotes the candidate's latest answer", () => {
    const prompt = builder().buildUserPrompt(contextFor("MAIN"));
    expect(prompt).toContain("The candidate just answered:");
    expect(prompt).toContain("I build things.");
    expect(prompt).toContain("probe, question");
  });

  it("says so when there is no answer yet", () => {
    const context = contextFor("OPENING");
    const withoutAnswer = { ...context, history: [] };
    const prompt = builder().buildUserPrompt(withoutAnswer);

    expect(prompt).toContain("No answer yet.");
    expect(prompt).toContain("open");
  });

  it("allows only closing moves once the session is forced to end", () => {
    const prompt = builder().buildUserPrompt(contextFor("ENDED"));
    expect(prompt).toContain("Allowed moves for this phase: closing.");
  });
});
