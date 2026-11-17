import { z } from "zod";

/**
 * Everything the AI interviewer is allowed to know about the candidate.
 * Built from onboarding answers plus (optionally) the parsed resume, then
 * validated with this schema before it is frozen onto the interview row.
 */

export const contextEducationSchema = z.object({
  level: z.string(),
  institution: z.string(),
  field_of_study: z.string().nullable(),
  start_year: z.number(),
  end_year: z.number().nullable(),
  is_current: z.boolean(),
  grade: z.string().nullable(),
});

export const contextWorkExperienceSchema = z.object({
  job_title: z.string(),
  company: z.string(),
  employment_type: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  is_current: z.boolean(),
  description: z.string().nullable(),
});

export const contextSkillSchema = z.object({
  name: z.string(),
  category: z.string(),
  level: z.string(),
});

export const contextLanguageSchema = z.object({
  language: z.string(),
  proficiency: z.string(),
  is_interview_language: z.boolean(),
});

export const contextCareerGoalSchema = z.object({
  target_role: z.string(),
  target_industry: z.string().nullable(),
  experience_level: z.string(),
  target_companies: z.array(z.string()),
  interview_type: z.string(),
  difficulty: z.string(),
  interview_language: z.string(),
  additional_notes: z.string().nullable(),
});

export const contextResumeExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_current: z.boolean(),
  highlights: z.array(z.string()),
});

export const contextResumeProjectSchema = z.object({
  name: z.string(),
  tech_stack: z.array(z.string()),
  description: z.string().nullable(),
});

export const contextResumeEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  grade: z.string().nullable(),
});

export const contextResumeCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable(),
  issue_date: z.string().nullable(),
});

export const contextResumeLanguageSchema = z.object({
  language: z.string(),
  proficiency: z.string().nullable(),
});

/** Resume-derived facts only — contact details (email/phone) are never sent to the LLM. */
export const contextResumeSchema = z.object({
  summary: z.string().nullable(),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
  }),
  experience: z.array(contextResumeExperienceSchema),
  projects: z.array(contextResumeProjectSchema),
  education: z.array(contextResumeEducationSchema),
  certifications: z.array(contextResumeCertificationSchema),
  languages: z.array(contextResumeLanguageSchema),
});

export const candidateContextSchema = z.object({
  candidate: z.object({
    full_name: z.string(),
    country: z.string().nullable(),
    city: z.string().nullable(),
    current_status: z.string().nullable(),
  }),
  goals: contextCareerGoalSchema,
  onboarding: z.object({
    education: z.array(contextEducationSchema),
    work_experience: z.array(contextWorkExperienceSchema),
    skills: z.array(contextSkillSchema),
    languages: z.array(contextLanguageSchema),
  }),
  /** Null when no completed resume exists or the candidate opted out. */
  resume: contextResumeSchema.nullable(),
  /** True only when a parsed resume existed at build time (drives the setup banner). */
  has_completed_resume: z.boolean(),
});

export type CandidateContext = z.infer<typeof candidateContextSchema>;
export type CandidateResumeContext = z.infer<typeof contextResumeSchema>;
