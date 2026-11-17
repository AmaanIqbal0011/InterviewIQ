import { z } from "zod";
import { difficultyValues, experienceLevelValues } from "@/lib/validation/onboardingSchemas";

/**
 * Shared between the setup form (client) and the create action (server) so
 * both ends enforce the exact same rules.
 */

export const interviewTypeValues = ["hr", "technical", "mixed"] as const;
export type InterviewType = (typeof interviewTypeValues)[number];

export const questionCountValues = ['5', '8', '10'] as const;

export const interviewLanguageValues = ["english", "urdu_hinglish"] as const;
export type InterviewLanguage = (typeof interviewLanguageValues)[number];

export const INTERVIEW_LANGUAGE_LABELS: Record<InterviewLanguage, string> = {
  english: "English",
  urdu_hinglish: "Urdu / Hinglish",
};

export const MAX_FOCUS_TOPICS = 8;
export const MAX_FOCUS_TOPIC_LENGTH = 60;

const focusTopicSchema = z
  .string()
  .trim()
  .min(1, "Focus topics can't be empty.")
  .max(MAX_FOCUS_TOPIC_LENGTH, `Keep each topic under ${MAX_FOCUS_TOPIC_LENGTH} characters.`);

export const interviewConfigSchema = z.object({
  target_role: z
    .string()
    .trim()
    .min(1, "Enter the role you're practicing for.")
    .max(120, "Keep the role under 120 characters."),
  experience_level: z.enum(experienceLevelValues),
  interview_type: z.enum(interviewTypeValues),
  difficulty: z.enum(difficultyValues),
  question_count: z.enum(questionCountValues, {
    message: "Choose 5, 8, or 10 questions.",
  }),
  interview_language: z.enum(interviewLanguageValues),
  focus_topics: z.array(focusTopicSchema).max(MAX_FOCUS_TOPICS, `Up to ${MAX_FOCUS_TOPICS} focus topics.`),
  /** When false the frozen context snapshot excludes resume data. */
  use_resume: z.boolean(),
});

export type InterviewConfig = z.infer<typeof interviewConfigSchema>;

/** Defaults for a brand-new session; the page pre-fills from onboarding. */
export const DEFAULT_INTERVIEW_CONFIG: InterviewConfig = {
  target_role: "",
  experience_level: "entry",
  interview_type: "mixed",
  difficulty: "medium",
  question_count: "5",
  interview_language: "english",
  focus_topics: [],
  use_resume: true,
};

/** Input shape the server action accepts before validation. */
export const createInterviewRequestSchema = interviewConfigSchema;
export type CreateInterviewRequest = z.infer<typeof createInterviewRequestSchema>;
