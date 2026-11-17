import { z } from "zod";
import { ACCEPTED_RESUME_MIME_TYPES, MAX_RESUME_BYTES } from "@/lib/resume/constants";

/**
 * Shape the LLM must return and the shape stored in `resume_profiles.parsed`.
 * Every field is required in the JSON schema so the provider emits a stable
 * structure; unknown facts are represented as `null` or an empty array.
 */
export const resumeSkillGroupSchema = z.object({
  technical: z.array(z.string()),
  soft: z.array(z.string()),
});

export const resumeEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  grade: z.string().nullable(),
});

export const resumeExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_current: z.boolean(),
  highlights: z.array(z.string()),
});

export const resumeProjectSchema = z.object({
  name: z.string(),
  tech_stack: z.array(z.string()),
  description: z.string().nullable(),
});

export const resumeCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable(),
  issue_date: z.string().nullable(),
});

export const resumeLanguageSchema = z.object({
  language: z.string(),
  proficiency: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  summary: z.string().nullable(),
  skills: resumeSkillGroupSchema,
  education: z.array(resumeEducationSchema),
  experience: z.array(resumeExperienceSchema),
  projects: z.array(resumeProjectSchema),
  certifications: z.array(resumeCertificationSchema),
  languages: z.array(resumeLanguageSchema),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type ParsedResumeExperience = z.infer<typeof resumeExperienceSchema>;
export type ParsedResumeEducation = z.infer<typeof resumeEducationSchema>;

/** Metadata sent by the browser after a direct-to-storage upload. */
export const registerResumeInputSchema = z.object({
  filePath: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ACCEPTED_RESUME_MIME_TYPES),
  size: z.number().int().positive().max(MAX_RESUME_BYTES),
});

export type RegisterResumeInput = z.infer<typeof registerResumeInputSchema>;

export const parseResumeRequestSchema = z.object({
  resumeId: z.string().uuid(),
});

/**
 * Gemini's `responseJsonSchema` accepts JSON Schema (2020-12) but treats
 * `type: ["string", "null"]` inconsistently, so nullable fields are rewritten
 * to `anyOf: [{ type }, { type: "null" }]`. `$schema` is dropped as well.
 */
export function buildLlmJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(parsedResumeSchema) as Record<string, unknown>;
  delete schema.$schema;
  return normalizeNullableTypes(schema) as Record<string, unknown>;
}

function normalizeNullableTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeNullableTypes);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;

  if (Array.isArray(type) && type.includes("null")) {
    const rest = { ...record };
    delete rest.type;
    const variants = type
      .filter((entry) => entry !== "null")
      .map((entry) => ({ type: entry }));

    return normalizeNullableTypes({
      ...rest,
      anyOf: [...variants, { type: "null" }],
    });
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, normalizeNullableTypes(entry)]),
  );
}
