import { z } from "zod";

export const currentStatusValues = [
  "student",
  "working_professional",
  "fresher",
  "career_switcher",
  "other",
] as const;
export const educationLevelValues = [
  "high_school",
  "diploma",
  "bachelors",
  "masters",
  "phd",
  "other",
] as const;
export const employmentTypeValues = ["full_time", "part_time", "contract", "internship", "other"] as const;
export const skillCategoryValues = ["technical", "soft", "tool"] as const;
export const skillLevelValues = ["beginner", "intermediate", "advanced"] as const;
export const proficiencyValues = ["basic", "conversational", "fluent", "native"] as const;
export const experienceLevelValues = ["entry", "junior", "mid", "senior"] as const;
export const interviewTypeValues = ["technical", "behavioral", "mixed", "hr"] as const;
export const difficultyValues = ["easy", "medium", "hard"] as const;
export const interviewLanguageValues = ["English", "Urdu", "Hinglish", "Other"] as const;
export const practiceGoalValues = [
  "confidence",
  "communication",
  "technical_answers",
  "behavioral_answers",
  "english_fluency",
  "time_management",
] as const;

const optionalIdSchema = z.string().uuid().optional();
const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => value || null);
const yearSchema = z.number().int().min(1900).max(new Date().getFullYear() + 1);
export const MAX_EDUCATION_END_YEAR = 2200;
const educationEndYearSchema = z.number().int().min(1900).max(MAX_EDUCATION_END_YEAR);
const dateSchema = z.iso.date();

export const aboutYouSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  current_status: z.enum(currentStatusValues),
});
export type AboutYouValues = z.infer<typeof aboutYouSchema>;

export const educationEntrySchema = z.object({
  id: optionalIdSchema,
  level: z.enum(educationLevelValues),
  institution: z.string().trim().min(1, "Institution is required.").max(160),
  field_of_study: optionalText(120),
  start_year: z.null(),
  end_year: z.null(),
  is_current: z.boolean(),
  grade: z.null(),
});

export const educationStepSchema = z.object({
  education: z.array(educationEntrySchema).length(1, "Add exactly one education entry."),
});
export type EducationEntryValues = z.infer<typeof educationEntrySchema>;
export type EducationStepValues = z.infer<typeof educationStepSchema>;

const dedupeStrings = (maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(10)
    .transform((items) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .refine((items) => items.length <= 10, "Keep up to 10 items.");

export const careerTargetStepSchema = z.object({
  career_goal: z.object({
    target_role: z.string().trim().min(1, "Enter your target role.").max(120),
    target_industry: optionalText(120),
    experience_level: z.enum(experienceLevelValues),
    target_companies: dedupeStrings(80),
  }),
  top_skills: dedupeStrings(50),
});
export type CareerTargetStepValues = z.infer<typeof careerTargetStepSchema>;

export const interviewSetupStepSchema = z.object({
  career_goal: z.object({
    interview_type: z.enum(interviewTypeValues),
    difficulty: z.enum(difficultyValues),
    interview_language: z.enum(interviewLanguageValues),
    practice_goals: z
      .array(z.enum(practiceGoalValues))
      .min(1, "Choose at least one practice goal.")
      .max(3, "Choose up to three practice goals."),
    additional_notes: optionalText(500),
  }),
  interview_language_proficiency: z.enum(proficiencyValues),
});
export type InterviewSetupStepValues = z.infer<typeof interviewSetupStepSchema>;

export interface OnboardingDraft {
  full_name: string;
  current_status: (typeof currentStatusValues)[number];
  education: Array<{
    id?: string;
    level: (typeof educationLevelValues)[number];
    institution: string;
    field_of_study: string | null;
    start_year: null;
    end_year: null;
    is_current: boolean;
    grade: null;
  }>;
  career_goal: {
    target_role: string;
    target_industry: string | null;
    experience_level: (typeof experienceLevelValues)[number];
    target_companies: string[];
    interview_type: (typeof interviewTypeValues)[number];
    difficulty: (typeof difficultyValues)[number];
    interview_language: (typeof interviewLanguageValues)[number];
    practice_goals: Array<(typeof practiceGoalValues)[number]>;
    additional_notes: string | null;
  };
  top_skills: string[];
  interview_language_proficiency: (typeof proficiencyValues)[number];
}

export interface SkillEntryValues {
  id?: string;
  name: string;
  category: (typeof skillCategoryValues)[number];
  level: (typeof skillLevelValues)[number];
}

export interface LanguageEntryValues {
  id?: string;
  language: string;
  proficiency: (typeof proficiencyValues)[number];
  is_interview_language: boolean;
}

export interface WorkExperienceEntryValues {
  id?: string;
  job_title: string;
  company: string;
  employment_type: (typeof employmentTypeValues)[number];
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export const onboardingSchemas = {
  aboutYou: aboutYouSchema,
  education: educationStepSchema,
  careerTarget: careerTargetStepSchema,
  interviewSetup: interviewSetupStepSchema,
} as const;
