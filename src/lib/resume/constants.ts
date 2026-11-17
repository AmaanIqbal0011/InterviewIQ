/** Shared resume rules used by both the browser card and the server pipeline. */

export const RESUME_BUCKET = "resumes";

/** 5 MB, mirrored by the storage bucket and the `resumes.size` check. */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPTED_RESUME_MIME_TYPES = [PDF_MIME_TYPE, DOCX_MIME_TYPE] as const;

export type ResumeMimeType = (typeof ACCEPTED_RESUME_MIME_TYPES)[number];

/** `accept` attribute for the file input (MIME types plus extensions). */
export const RESUME_FILE_ACCEPT = [
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
  ".pdf",
  ".docx",
].join(",");

/** Cap on the text stored in `resume_profiles.raw_text`. */
export const MAX_STORED_RESUME_TEXT_CHARS = 200_000;

/** Cap on the text sent to the LLM, keeping prompts inside a sane token budget. */
export const MAX_PROMPT_RESUME_TEXT_CHARS = 30_000;

export function isAcceptedResumeMimeType(value: string): value is ResumeMimeType {
  return (ACCEPTED_RESUME_MIME_TYPES as readonly string[]).includes(value);
}

/** Infers the MIME type from the file extension when the browser omits `File.type`. */
export function inferResumeMimeType(fileName: string): ResumeMimeType | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return PDF_MIME_TYPE;
  if (extension === "docx") return DOCX_MIME_TYPE;
  return null;
}

export interface ResumeFileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export type ResumeFileValidationCode =
  | "unsupported_file"
  | "file_too_large"
  | "empty_file";

export interface ResumeFileValidationError {
  readonly code: ResumeFileValidationCode;
  readonly message: string;
}

/** Client-side pre-flight validation; the server repeats every check. */
export function validateResumeFile(file: ResumeFileLike): ResumeFileValidationError | null {
  const mimeType = isAcceptedResumeMimeType(file.type)
    ? file.type
    : inferResumeMimeType(file.name);

  if (!mimeType) {
    return {
      code: "unsupported_file",
      message: "That file type isn't supported. Upload a PDF or DOCX file.",
    };
  }

  if (file.size === 0) {
    return { code: "empty_file", message: "That file is empty. Choose another file." };
  }

  if (file.size > MAX_RESUME_BYTES) {
    return {
      code: "file_too_large",
      message: "That file is larger than 5 MB. Choose a smaller file.",
    };
  }

  return null;
}

/** Human-readable file size for the card, e.g. "412 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
