import type { OnboardingProgress } from "@/services/OnboardingService";
import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import {
  candidateContextSchema,
  type CandidateContext,
  type CandidateResumeContext,
} from "@/lib/validation/candidateContextSchemas";

/** Everything the builder needs, behind an interface so tests can stub it. */
export interface CandidateDataSource {
  loadOnboarding(userId: string): Promise<OnboardingProgress>;
  /** Latest successfully parsed resume, or null when none is ready. */
  loadCompletedResume(userId: string): Promise<ParsedResume | null>;
}

export interface BuildCandidateContextOptions {
  /** When false the resume half of the context is omitted entirely. */
  readonly useResume: boolean;
}

/** Recursively freezes a value so a published context can never be mutated. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Gathers every fact we hold about the candidate — all onboarding answers and
 * all parsed CV data — into one Zod-validated, deeply frozen `CandidateContext`.
 *
 * Fallback rule: with no completed resume (or `useResume: false`) the context
 * falls back to onboarding data only; `resume` becomes null while
 * `has_completed_resume` still reports whether one exists, so the UI can show
 * the "upload your resume" banner.
 */
export class CandidateContextBuilder {
  private readonly source: CandidateDataSource;

  constructor(source: CandidateDataSource) {
    this.source = source;
  }

  async build(userId: string, options: BuildCandidateContextOptions): Promise<CandidateContext> {
    // The resume is always loaded so `has_completed_resume` can drive the
    // setup banner even when the candidate opted out of using it.
    const [onboarding, parsedResume] = await Promise.all([
      this.source.loadOnboarding(userId),
      this.source.loadCompletedResume(userId),
    ]);

    const goal = onboarding.careerGoal;
    if (!goal) {
      // Onboarding is gated behind a completed career goal; treat its absence
      // as a data problem rather than silently producing a hollow context.
      throw new Error("Career goals are required to build candidate context.");
    }

    const raw = {
      candidate: {
        full_name: onboarding.profile.fullName,
        country: onboarding.profile.country,
        city: onboarding.profile.city,
        current_status: onboarding.profile.currentStatus,
      },
      goals: {
        target_role: goal.targetRole,
        target_industry: goal.targetIndustry,
        experience_level: goal.experienceLevel,
        target_companies: goal.targetCompanies,
        interview_type: goal.interviewType,
        difficulty: goal.difficulty,
        interview_language: goal.interviewLanguage,
        additional_notes: goal.additionalNotes,
      },
      onboarding: {
        education: onboarding.education.map((entry) => ({
          level: entry.level,
          institution: entry.institution,
          field_of_study: entry.fieldOfStudy,
          start_year: entry.startYear,
          end_year: entry.endYear,
          is_current: entry.isCurrent,
          grade: entry.grade,
        })),
        work_experience: onboarding.workExperiences.map((entry) => ({
          job_title: entry.jobTitle,
          company: entry.company,
          employment_type: entry.employmentType,
          start_date: entry.startDate,
          end_date: entry.endDate,
          is_current: entry.isCurrent,
          description: entry.description,
        })),
        skills: onboarding.skills.map((skill) => ({
          name: skill.name,
          category: skill.category,
          level: skill.level,
        })),
        languages: onboarding.languages.map((language) => ({
          language: language.language,
          proficiency: language.proficiency,
          is_interview_language: language.isInterviewLanguage,
        })),
      },
      resume: options.useResume && parsedResume
        ? toResumeContext(parsedResume)
        : null,
      has_completed_resume: parsedResume !== null,
    };

    const parsed = candidateContextSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("Candidate context failed validation.", { cause: parsed.error });
    }
    return deepFreeze(parsed.data);
  }
}

/** Strips contact details: the prompt never needs email or phone. */
function toResumeContext(resume: ParsedResume): CandidateResumeContext {
  return {
    summary: resume.summary,
    skills: resume.skills,
    experience: resume.experience.map((entry) => ({
      company: entry.company,
      title: entry.title,
      start_date: entry.start_date,
      end_date: entry.end_date,
      is_current: entry.is_current,
      highlights: entry.highlights,
    })),
    projects: resume.projects,
    education: resume.education,
    certifications: resume.certifications,
    languages: resume.languages,
  };
}
