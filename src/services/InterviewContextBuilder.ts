import type { OnboardingProgress } from "@/services/OnboardingService";

export interface InterviewContext {
  readonly candidate_summary: string;
  readonly education: ReadonlyArray<{
    level: string;
    institution: string;
    field_of_study: string | null;
    duration: string;
  }>;
  readonly experience: ReadonlyArray<{
    job_title: string;
    company: string;
    period: string;
    employment_type: string;
  }>;
  readonly skills: ReadonlyArray<{
    name: string;
    category: string;
    level: string;
  }>;
  readonly languages: ReadonlyArray<{
    language: string;
    proficiency: string;
    is_interview_language: boolean;
  }>;
  readonly target_role: string;
  readonly target_industry: string | null;
  readonly experience_level: string;
  readonly interview_type: string;
  readonly difficulty: string;
  readonly interview_language: string;
  readonly additional_notes: string | null;
  toPromptText(): string;
}

export class InterviewContextBuilder implements InterviewContext {
  readonly candidate_summary: string;
  readonly education: InterviewContext["education"];
  readonly experience: InterviewContext["experience"];
  readonly skills: InterviewContext["skills"];
  readonly languages: InterviewContext["languages"];
  readonly target_role: string;
  readonly target_industry: string | null;
  readonly experience_level: string;
  readonly interview_type: string;
  readonly difficulty: string;
  readonly interview_language: string;
  readonly additional_notes: string | null;

  constructor(profile: OnboardingProgress) {
    const goal = profile.careerGoal;
    if (!goal) {
      throw new Error("Career goals are required to build interview context.");
    }

    const status = profile.profile.currentStatus?.replaceAll("_", " ") ?? "candidate";
    this.candidate_summary = `${status} preparing for a ${goal.experienceLevel}-level ${goal.targetRole} role.`;
    this.education = profile.education.map((entry) => ({
      level: entry.level,
      institution: entry.institution,
      field_of_study: entry.fieldOfStudy,
      duration: entry.isCurrent || entry.endYear === null
        ? `${entry.startYear}–present`
        : `${entry.startYear}–${entry.endYear}`,
    }));
    this.experience = profile.workExperiences.map((entry) => ({
      job_title: entry.jobTitle,
      company: entry.company,
      period: entry.isCurrent || entry.endDate === null
        ? `${entry.startDate}–present`
        : `${entry.startDate}–${entry.endDate}`,
      employment_type: entry.employmentType,
    }));
    this.skills = profile.skills.map((skill) => ({
      name: skill.name,
      category: skill.category,
      level: skill.level,
    }));
    this.languages = profile.languages.map((language) => ({
      language: language.language,
      proficiency: language.proficiency,
      is_interview_language: language.isInterviewLanguage,
    }));
    this.target_role = goal.targetRole;
    this.target_industry = goal.targetIndustry;
    this.experience_level = goal.experienceLevel;
    this.interview_type = goal.interviewType;
    this.difficulty = goal.difficulty;
    this.interview_language = goal.interviewLanguage;
    this.additional_notes = goal.additionalNotes;
  }

  toPromptText(): string {
    const sections = [
      `Candidate: ${this.candidate_summary}`,
      `Target industry: ${this.target_industry ?? "Not specified"}`,
      `Interview: ${this.interview_type}, ${this.difficulty} difficulty, in ${this.interview_language}`,
      `Education: ${this.education.map((item) =>
        `${item.level} in ${item.field_of_study ?? "unspecified"} at ${item.institution} (${item.duration})`,
      ).join("; ") || "Not provided"}`,
      `Experience: ${this.experience.map((item) =>
        `${item.job_title} at ${item.company} (${item.employment_type}, ${item.period})`,
      ).join("; ") || "Not provided"}`,
      `Skills: ${this.skills.map((item) =>
        `${item.name} (${item.level}, ${item.category})`,
      ).join("; ")}`,
      `Languages: ${this.languages.map((item) =>
        `${item.language} (${item.proficiency}${item.is_interview_language ? ", interview language" : ""})`,
      ).join("; ")}`,
    ];
    if (this.additional_notes) sections.push(`Candidate preferences: ${this.additional_notes}`);
    return sections.join("\n");
  }
}
