/** Card-level view of resume ingestion shared by the dashboard and the API. */

export type ResumeStatus =
  | "not_uploaded"
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export interface ResumeHighlights {
  readonly fullName: string | null;
  readonly summary: string | null;
  readonly topSkills: readonly string[];
  readonly latestRole: string | null;
  readonly education: string | null;
}

export interface ResumeInfo {
  readonly resumeId: string | null;
  readonly status: ResumeStatus;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly size: number | null;
  readonly errorMessage: string | null;
  readonly updatedAt: string | null;
  readonly highlights: ResumeHighlights | null;
}

export const EMPTY_RESUME_INFO: ResumeInfo = {
  resumeId: null,
  status: "not_uploaded",
  fileName: null,
  mimeType: null,
  size: null,
  errorMessage: null,
  updatedAt: null,
  highlights: null,
};
