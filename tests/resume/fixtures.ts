import { Resume, type ResumeProps } from "@/models/Resume";
import { ResumeProfile } from "@/models/ResumeProfile";
import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import type { Json } from "@/types/database";

export const sampleParsedResume: ParsedResume = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  summary: "Backend engineer focused on data platforms.",
  skills: {
    technical: ["TypeScript", "PostgreSQL", "Node.js"],
    soft: ["Mentoring", "Written communication"],
  },
  education: [
    {
      institution: "University of London",
      degree: "BSc Computer Science",
      field_of_study: "Computer Science",
      start_date: "2016",
      end_date: "2019",
      grade: "First class",
    },
  ],
  experience: [
    {
      company: "Analytical Engines",
      title: "Senior Engineer",
      start_date: "2022",
      end_date: null,
      is_current: true,
      highlights: ["Led the data platform migration"],
    },
  ],
  projects: [
    {
      name: "InterviewIQ",
      tech_stack: ["Next.js", "Supabase"],
      description: "AI interview coach",
    },
  ],
  certifications: [{ name: "AWS Solutions Architect", issuer: "Amazon", issue_date: "2023" }],
  languages: [{ language: "English", proficiency: "Native" }],
};

export const sampleResume = new Resume({
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  file_path: "user-1/abc-resume.pdf",
  file_name: "resume.pdf",
  mime_type: "application/pdf",
  size: 4096,
  created_at: "2026-01-01T00:00:00.000Z",
});

export function makeResume(overrides: Partial<ResumeProps> = {}): Resume {
  return new Resume({
    id: sampleResume.id,
    user_id: sampleResume.userId,
    file_path: sampleResume.filePath,
    file_name: sampleResume.fileName,
    mime_type: sampleResume.mimeType,
    size: sampleResume.size,
    created_at: sampleResume.createdAt,
    ...overrides,
  });
}

export function makeProfile(
  overrides: Partial<{
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    errorMessage: string | null;
    parsed: ParsedResume | null;
    resumeId: string;
    userId: string;
  }> = {},
): ResumeProfile {
  return new ResumeProfile({
    id: "22222222-2222-4222-8222-222222222222",
    user_id: overrides.userId ?? "user-1",
    resume_id: overrides.resumeId ?? sampleResume.id,
    status: overrides.status ?? "completed",
    error_message: overrides.errorMessage ?? null,
    raw_text: "Resume text",
    parsed: (overrides.parsed ?? sampleParsedResume) as unknown as Json,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:05.000Z",
  });
}
