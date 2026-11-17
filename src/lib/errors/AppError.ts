export type AppErrorCode = "unauthenticated" | "not_found" | "database" | "invalid_input";

const MESSAGES: Record<AppErrorCode, string> = {
  unauthenticated: "Please sign in again to continue.",
  not_found: "We couldn't find your profile. Please sign in again.",
  database: "Something went wrong on our side. Please try again.",
  invalid_input: "Please review your answers and try again.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, options?: { cause?: unknown }) {
    super(MESSAGES[code], options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
  }
}
