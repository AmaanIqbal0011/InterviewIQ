import type { InterviewConfig } from "@/lib/validation/interviewSchemas";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import type { CandidateContext } from "@/lib/validation/candidateContextSchemas";
import { Interview } from "@/models/Interview";
import type { CreateInterviewInput, IInterviewRepository } from "@/repositories/InterviewRepository";
import type { CandidateContextBuilder } from "./CandidateContextBuilder";
import { AppError } from "@/lib/errors/AppError";

/** Everything the setup page needs to pre-fill the form and show the panel. */
export interface InterviewSetupData {
  /** Config with onboarding answers pre-filled; focus topics start empty. */
  readonly defaults: InterviewConfig;
  /** Context built with the resume toggle in its default (on) position. */
  readonly context: CandidateContext;
  /** Chip suggestions for focus topics: CV + onboarding technical skills. */
  readonly skillSuggestions: readonly string[];
}

/**
 * Facade for Phase A: assembles setup-page data and creates interview rows.
 * The frozen `context_snapshot` is written here, at creation time, so every
 * later phase reads personalization from the row instead of re-deriving it.
 */
export class InterviewService {
  private readonly interviews: IInterviewRepository;
  private readonly contextBuilder: CandidateContextBuilder;

  constructor(interviews: IInterviewRepository, contextBuilder: CandidateContextBuilder) {
    this.interviews = interviews;
    this.contextBuilder = contextBuilder;
  }

  async getSetupData(userId: string): Promise<InterviewSetupData> {
    const context = await this.contextBuilder.build(userId, { useResume: true });
    const goal = context.goals;

    const defaults: InterviewConfig = {
      target_role: goal.target_role,
      experience_level: this.toExperienceLevel(goal.experience_level),
      interview_type: this.toInterviewType(goal.interview_type),
      difficulty: this.toDifficulty(goal.difficulty),
      duration_minutes: "5",
      interview_language: goal.interview_language.toLowerCase().includes("urdu")
        ? "urdu_hinglish"
        : "english",
      focus_topics: [],
      use_resume: context.has_completed_resume,
    };

    return {
      defaults,
      context,
      skillSuggestions: this.skillSuggestions(context),
    };
  }

  async createInterview(userId: string, rawConfig: unknown): Promise<Interview> {
    const parsed = interviewConfigSchema.safeParse(rawConfig);
    if (!parsed.success) {
      throw new AppError("invalid_input", { cause: parsed.error });
    }
    const config = parsed.data;

    const context = await this.contextBuilder.build(userId, { useResume: config.use_resume });
    const input: CreateInterviewInput = {
      role: config.target_role,
      config,
      contextSnapshot: context,
    };
    return this.interviews.create(userId, input);
  }

  /** Technical skills first, capped so the chip row stays scannable. */
  private skillSuggestions(context: CandidateContext): string[] {
    const onboarding = context.onboarding.skills
      .filter((skill) => skill.category !== "soft")
      .map((skill) => skill.name);
    const fromResume = context.resume?.skills.technical ?? [];
    return Array.from(new Set([...fromResume, ...onboarding])).slice(0, 14);
  }

  private toExperienceLevel(value: string): InterviewConfig["experience_level"] {
    return value === "junior" || value === "mid" || value === "senior"
      ? value
      : "entry";
  }

  private toInterviewType(value: string): InterviewConfig["interview_type"] {
    return value === "hr" || value === "technical" || value === "mixed"
      ? value
      : "mixed";
  }

  private toDifficulty(value: string): InterviewConfig["difficulty"] {
    return value === "easy" || value === "hard" ? value : "medium";
  }
}
