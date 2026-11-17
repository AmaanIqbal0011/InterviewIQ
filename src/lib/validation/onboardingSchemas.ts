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
  country: z.string().trim().min(1, "Enter your country.").max(80, "Keep your country under 80 characters."),
  city: z.string().trim().min(1, "Enter your city.").max(80, "Keep your city under 80 characters."),
  current_status: z.enum(currentStatusValues),
});
export type AboutYouValues = z.infer<typeof aboutYouSchema>;

export const educationEntrySchema = z.object({
  id: optionalIdSchema,
  level: z.enum(educationLevelValues),
  institution: z.string().trim().min(1, "Institution is required.").max(160),
  field_of_study: optionalText(120),
  start_year: yearSchema,
  end_year: educationEndYearSchema.nullable(),
  is_current: z.boolean(),
  grade: optionalText(30),
}).superRefine((entry, context) => {
  if (entry.end_year !== null && entry.end_year < entry.start_year) {
    context.addIssue({ code: "custom", path: ["end_year"], message: "End year must follow start year." });
  }
  if (!entry.is_current && entry.end_year === null) {
    context.addIssue({ code: "custom", path: ["end_year"], message: "Add an end year or mark this as ongoing." });
  }
});

export const educationStepSchema = z.object({
  education: z.array(educationEntrySchema).min(1, "Add at least one education entry.").max(10),
});
export type EducationEntryValues = z.infer<typeof educationEntrySchema>;
export type EducationStepValues = z.infer<typeof educationStepSchema>;

export const workExperienceEntrySchema = z.object({
  id: optionalIdSchema,
  job_title: z.string().trim().min(1, "Job title is required.").max(120),
  company: z.string().trim().min(1, "Company is required.").max(160),
  employment_type: z.enum(employmentTypeValues),
  start_date: dateSchema,
  end_date: dateSchema.nullable(),
  is_current: z.boolean(),
  description: optionalText(1000),
}).superRefine((entry, context) => {
  if (entry.end_date !== null && entry.end_date < entry.start_date) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "End date must follow start date." });
  }
  if (entry.is_current && entry.end_date !== null) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "Current roles cannot have an end date." });
  }
  if (!entry.is_current && entry.end_date === null) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "Add an end date or mark this as current." });
  }
});

export const workExperienceStepSchema = z.object({
  no_experience: z.boolean(),
  work_experiences: z.array(workExperienceEntrySchema).max(15),
}).superRefine((values, context) => {
  if (values.no_experience && values.work_experiences.length > 0) {
    context.addIssue({ code: "custom", path: ["work_experiences"], message: "Remove roles or turn off this option." });
  }
});
export type WorkExperienceEntryValues = z.infer<typeof workExperienceEntrySchema>;
export type WorkExperienceStepValues = z.infer<typeof workExperienceStepSchema>;

export const skillEntrySchema = z.object({
  id: optionalIdSchema,
  name: z.string().trim().min(1, "Skill name is required.").max(50),
  category: z.enum(skillCategoryValues),
  level: z.enum(skillLevelValues),
});
export const skillsStepSchema = z.object({
  skills: z.array(skillEntrySchema).min(3, "Add at least 3 skills.").max(30),
});
export type SkillEntryValues = z.infer<typeof skillEntrySchema>;
export type SkillsStepValues = z.infer<typeof skillsStepSchema>;

export const languageEntrySchema = z.object({
  id: optionalIdSchema,
  language: z.string().trim().min(1, "Language is required.").max(50),
  proficiency: z.enum(proficiencyValues),
  is_interview_language: z.boolean(),
});
export const languagesStepSchema = z.object({
  languages: z.array(languageEntrySchema).min(1, "Add at least one language.").max(8),
}).superRefine(({ languages }, context) => {
  const selected = languages.filter((language) => language.is_interview_language).length;
  if (selected !== 1) {
    context.addIssue({
      code: "custom",
      path: ["languages"],
      message: "Choose exactly one interview language for your AI interviewer.",
    });
  }
});
export type LanguageEntryValues = z.infer<typeof languageEntrySchema>;
export type LanguagesStepValues = z.infer<typeof languagesStepSchema>;

export const careerGoalSchema = z.object({
  target_role: z.string().trim().min(1, "Enter your target role.").max(120),
  target_industry: optionalText(120),
  experience_level: z.enum(experienceLevelValues),
  target_companies: z.array(z.string().trim().min(1).max(80)).max(10),
  interview_type: z.enum(interviewTypeValues),
  difficulty: z.enum(difficultyValues),
  interview_language: z.string().trim().min(1).max(50),
  additional_notes: optionalText(500),
});
export const careerGoalsStepSchema = z.object({ career_goal: careerGoalSchema });
export type CareerGoalValues = z.infer<typeof careerGoalSchema>;
export type CareerGoalsStepValues = z.infer<typeof careerGoalsStepSchema>;

export interface OnboardingDraft extends
  AboutYouValues,
  EducationStepValues,
  WorkExperienceStepValues,
  SkillsStepValues,
  LanguagesStepValues,
  CareerGoalsStepValues {}

export const onboardingSchemas = {
  aboutYou: aboutYouSchema,
  education: educationStepSchema,
  workExperience: workExperienceStepSchema,
  skills: skillsStepSchema,
  languages: languagesStepSchema,
  careerGoals: careerGoalsStepSchema,
} as const;
