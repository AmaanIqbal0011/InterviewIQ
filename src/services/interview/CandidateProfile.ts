import type { CandidateContext } from "@/lib/validation/candidateContextSchemas";

export interface CandidateProjectFact {
  readonly name: string;
  readonly techStack: readonly string[];
  readonly description: string | null;
}

export type CandidateProfileSource = "cv" | "onboarding" | "unknown";

/**
 * The interview-facing view of everything we know about the candidate:
 * name, education, skills, projects and experience — extracted from the CV
 * when one was uploaded (`ResumeParser` → `ResumeProfile` → context snapshot)
 * and from onboarding answers otherwise.
 *
 * Built once per session and injected into every prompt so the interviewer can
 * reference real facts ("I see you built X using Next.js…") instead of asking
 * for things we already know.
 */
export class CandidateProfile {
  readonly fullName: string | null;
  readonly source: CandidateProfileSource;
  readonly currentStatus: string | null;
  readonly summary: string | null;
  readonly skills: readonly string[];
  readonly projects: readonly CandidateProjectFact[];
  readonly experience: readonly string[];
  readonly education: readonly string[];
  /** Highest education signal we have, used to pitch question difficulty. */
  readonly educationLevel: string | null;

  constructor(props: {
    fullName: string | null;
    source: CandidateProfileSource;
    currentStatus: string | null;
    summary: string | null;
    skills: readonly string[];
    projects: readonly CandidateProjectFact[];
    experience: readonly string[];
    education: readonly string[];
    educationLevel: string | null;
  }) {
    this.fullName = props.fullName;
    this.source = props.source;
    this.currentStatus = props.currentStatus;
    this.summary = props.summary;
    this.skills = props.skills;
    this.projects = props.projects;
    this.experience = props.experience;
    this.education = props.education;
    this.educationLevel = props.educationLevel;
  }

  /**
   * Prefer CV facts; fall back to onboarding answers; report `unknown` when
   * neither side carries a usable name (the interviewer then asks naturally).
   */
  static fromContext(context: CandidateContext): CandidateProfile {
    const resume = context.resume;
    const cvName = resume?.full_name?.trim() || null;
    const onboardingName = context.candidate.full_name.trim() || null;
    const fullName = cvName ?? onboardingName;

    const skills = CandidateProfile.unique([
      ...(resume?.skills.technical ?? []),
      ...(resume?.skills.soft ?? []),
      ...context.onboarding.skills.map((skill) => skill.name),
    ]);

    const projects: CandidateProjectFact[] = (resume?.projects ?? []).map((project) => ({
      name: project.name,
      techStack: project.tech_stack,
      description: project.description,
    }));

    const experience = CandidateProfile.unique([
      ...(resume?.experience.map((entry) =>
        entry.highlights.length > 0
          ? `${entry.title} at ${entry.company}: ${entry.highlights.slice(0, 2).join("; ")}`
          : `${entry.title} at ${entry.company}`,
      ) ?? []),
      ...context.onboarding.work_experience.map((entry) =>
        entry.description
          ? `${entry.job_title} at ${entry.company}: ${entry.description}`
          : `${entry.job_title} at ${entry.company}`,
      ),
    ]);

    const education = CandidateProfile.unique([
      ...(resume?.education.map((entry) =>
        [entry.degree, entry.field_of_study, entry.institution].filter(Boolean).join(", "),
      ) ?? []),
      ...context.onboarding.education.map((entry) =>
        [entry.level, entry.field_of_study, entry.institution].filter(Boolean).join(", "),
      ),
    ]).filter((entry) => entry.trim().length > 0);

    return new CandidateProfile({
      fullName,
      source: cvName ? "cv" : onboardingName ? "onboarding" : "unknown",
      currentStatus: context.candidate.current_status,
      summary: resume?.summary ?? null,
      skills,
      projects,
      experience,
      education,
      educationLevel: CandidateProfile.deriveEducationLevel(
        resume?.education ?? [],
        context.onboarding.education,
      ),
    });
  }

  /** First name for greetings; null when we genuinely do not know it. */
  get firstName(): string | null {
    if (!this.fullName) return null;
    const first = this.fullName.split(/\s+/)[0]?.trim() ?? "";
    return first.length > 0 ? first : null;
  }

  get hasName(): boolean {
    return this.firstName !== null;
  }

  /** Short list of concrete hooks the interviewer can reference by name. */
  hooks(limit = 4): readonly string[] {
    return [
      ...this.projects.map((project) => `${project.name}${project.techStack.length > 0 ? ` (${project.techStack.slice(0, 3).join(", ")})` : ""}`),
      ...this.experience,
    ].slice(0, limit);
  }

  /** The profile block injected into every system prompt. */
  describe(): string {
    const lines: string[] = [];
    lines.push(
      this.fullName
        ? `Candidate name: ${this.fullName}.`
        : "Candidate name: unknown — ask for it naturally in your opening, as a person would.",
    );
    if (this.source === "cv") lines.push("Source: their uploaded CV.");
    if (this.currentStatus) lines.push(`Currently: ${this.currentStatus}.`);
    if (this.educationLevel) lines.push(`Education level: ${this.educationLevel}.`);
    if (this.education.length > 0) lines.push(`Education: ${this.education.slice(0, 4).join(" | ")}.`);
    if (this.skills.length > 0) lines.push(`Skills: ${this.skills.slice(0, 14).join(", ")}.`);
    if (this.projects.length > 0) {
      lines.push(
        `Projects: ${this.projects
          .slice(0, 5)
          .map((project) => `${project.name}${project.techStack.length > 0 ? ` [${project.techStack.join(", ")}]` : ""}`)
          .join(" | ")}.`,
      );
    }
    if (this.experience.length > 0) lines.push(`Experience: ${this.experience.slice(0, 5).join(" | ")}.`);
    if (this.summary) lines.push(`CV summary: ${this.summary.slice(0, 400)}.`);
    if (lines.length === 1) lines.push("No profile details are available beyond the name.");
    return lines.join("\n");
  }

  private static unique(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
    return result;
  }

  /** Rough highest-qualification signal, from the CV first and onboarding second. */
  private static deriveEducationLevel(
    resumeEducation: readonly { degree: string | null }[],
    onboardingEducation: readonly { level: string }[],
  ): string | null {
    const degrees = resumeEducation
      .map((entry) => entry.degree?.trim())
      .filter((degree): degree is string => Boolean(degree));
    if (degrees.length > 0) return degrees[0] ?? null;
    const levels = onboardingEducation.map((entry) => entry.level.trim()).filter(Boolean);
    return levels[0] ?? null;
  }
}
