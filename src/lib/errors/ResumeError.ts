/**
 * Typed resume-pipeline failures. Messages are safe to show to users and never
 * include resume contents or personal data.
 */

export type ResumeErrorCode =
  | "unsupported_file"
  | "file_too_large"
  | "extraction_failed"
  | "parsing_failed"
  | "storage_failed"
  | "resume_not_found";

const DEFAULT_MESSAGES: Record<ResumeErrorCode, string> = {
  unsupported_file: "That file type isn't supported. Upload a PDF or DOCX file.",
  file_too_large: "That file is larger than 5 MB. Choose a smaller file.",
  extraction_failed:
    "We couldn't read any text from that file. If it's a scanned PDF, try a text-based PDF or DOCX.",
  parsing_failed:
    "We couldn't understand that resume. Please try again in a moment.",
  storage_failed: "We couldn't access your file. Please upload it again.",
  resume_not_found: "We couldn't find that resume. Please upload it again.",
};

const STATUS_BY_CODE: Record<ResumeErrorCode, number> = {
  unsupported_file: 415,
  file_too_large: 413,
  extraction_failed: 422,
  parsing_failed: 422,
  storage_failed: 502,
  resume_not_found: 404,
};

export class ResumeError extends Error {
  readonly code: ResumeErrorCode;
  readonly httpStatus: number;

  constructor(code: ResumeErrorCode, options?: { cause?: unknown; message?: string }) {
    super(options?.message ?? DEFAULT_MESSAGES[code], {
      cause: options?.cause,
    });
    this.name = "ResumeError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
  }
}

export class UnsupportedFileError extends ResumeError {
  constructor() {
    super("unsupported_file");
    this.name = "UnsupportedFileError";
  }
}

export class FileTooLargeError extends ResumeError {
  constructor() {
    super("file_too_large");
    this.name = "FileTooLargeError";
  }
}

export class ExtractionError extends ResumeError {
  constructor(options?: { cause?: unknown }) {
    super("extraction_failed", options);
    this.name = "ExtractionError";
  }
}

export class ParsingError extends ResumeError {
  constructor(options?: { cause?: unknown; message?: string }) {
    super("parsing_failed", options);
    this.name = "ParsingError";
  }
}

export class ResumeStorageError extends ResumeError {
  constructor(options?: { cause?: unknown; message?: string }) {
    super("storage_failed", options);
    this.name = "ResumeStorageError";
  }
}
