import { z } from "zod";
import { difficultyValues, experienceLevelValues } from "@/lib/validation/onboardingSchemas";

/**
 * Shared between the setup form (client) and the create action (server) so
 * both ends enforce the exact same rules.
 */

export const interviewTypeValues = ["hr", "technical", "mixed"] as const;
export type InterviewType = (typeof interviewTypeValues)[number];

/** Session length the candidate picks before the interview starts. */
export const durationValues = ["3", "5", "10", "15"] as const;
export type InterviewDuration = (typeof durationValues)[number];

export const DURATION_MINUTES: Record<InterviewDuration, number> = {
  "3": 3,
  "5": 5,
  "10": 10,
  "15": 15,
};

export const DURATION_LABELS: Record<InterviewDuration, string> = {
  "3": "Quick screen",
  "5": "Standard",
  "10": "Deep dive",
  "15": "Full loop",
};

/** Seconds of runway the interviewer keeps for the wrap-up conversation. */
export const WRAP_UP_SECONDS = 45;

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
  duration_minutes: z.enum(durationValues, {
    message: "Choose a 3, 5, 10, or 15 minute interview.",
  }).default("5"),
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
  duration_minutes: "5",
  interview_language: "english",
  focus_topics: [],
  use_resume: true,
};

/** Input shape the server action accepts before validation. */
export const createInterviewRequestSchema = interviewConfigSchema;
export type CreateInterviewRequest = z.infer<typeof createInterviewRequestSchema>;
