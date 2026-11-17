import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import type { Resume } from "@/models/Resume";
import type { ResumeHighlights, ResumeInfo } from "@/models/ResumeInfo";
import type { ResumeProfile } from "@/models/ResumeProfile";

const MAX_TOP_SKILLS = 8;

function firstNonEmpty(values: readonly (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function buildHighlights(parsed: ParsedResume): ResumeHighlights {
  const education = parsed.education[0];
  const latestExperience = parsed.experience[0];

  const skills = [...parsed.skills.technical, ...parsed.skills.soft]
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    fullName: firstNonEmpty([parsed.full_name]),
    summary: firstNonEmpty([parsed.summary]),
    topSkills: Array.from(new Set(skills)).slice(0, MAX_TOP_SKILLS),
    latestRole: latestExperience
      ? firstNonEmpty([
          latestExperience.title && latestExperience.company
            ? `${latestExperience.title} at ${latestExperience.company}`
            : latestExperience.title || latestExperience.company,
        ])
      : null,
    education: education
      ? firstNonEmpty([
          [education.degree, education.institution].filter(Boolean).join(" · "),
          education.institution,
          education.field_of_study,
        ])
      : null,
  };
}

/**
 * Projects a resume row plus its parse state into the single DTO the card
 * renders. Page and API share this so both report identical states.
 */
export function buildResumeInfo(
  resume: Resume | null,
  profile: ResumeProfile | null,
): ResumeInfo {
  if (!resume) {
    return {
      resumeId: null,
      status: "not_uploaded",
      fileName: null,
      mimeType: null,
      size: null,
      errorMessage: null,
      updatedAt: null,
      highlights: null,
    };
  }

  const base = {
    resumeId: resume.id,
    fileName: resume.fileName,
    mimeType: resume.mimeType,
    size: resume.size,
    updatedAt: profile?.updatedAt ?? resume.createdAt,
  } as const;

  if (!profile || profile.status === "pending") {
    return { ...base, status: "pending", errorMessage: null, highlights: null };
  }

  if (profile.status === "processing") {
    return { ...base, status: "processing", errorMessage: null, highlights: null };
  }

  if (profile.status === "failed") {
    return {
      ...base,
      status: "failed",
      errorMessage:
        profile.errorMessage ??
        "We couldn't parse that resume. Please try again.",
      highlights: null,
    };
  }

  if (!profile.parsed) {
    return {
      ...base,
      status: "failed",
      errorMessage:
        "We parsed the file but couldn't read its details. Please try again.",
      highlights: null,
    };
  }

  return {
    ...base,
    status: "ready",
    errorMessage: null,
    highlights: buildHighlights(profile.parsed),
  };
}
