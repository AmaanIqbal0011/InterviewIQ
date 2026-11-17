/**
 * Typed interview-pipeline failures. Messages are safe to show to users and
 * never include answers, resume contents, or prompt text.
 */

export type InterviewErrorCode =
  | "interview_not_found"
  | "interview_already_completed"
  | "interview_not_started"
  | "evaluation_failed"
  | "question_generation_failed"
  | "report_generation_failed"
  | "rate_limited"
  | "answer_too_long"
  | "llm_not_configured";

const DEFAULT_MESSAGES: Record<InterviewErrorCode, string> = {
  interview_not_found: "We couldn't find that interview. It may have been deleted.",
  interview_already_completed: "This interview is already finished. Start a new one to keep practicing.",
  interview_not_started: "This interview hasn't started yet.",
  evaluation_failed: "We couldn't evaluate that answer just now. Please try again.",
  question_generation_failed: "We couldn't prepare the next question. Please try again.",
  report_generation_failed: "We couldn't build your report just now. Please retry.",
  rate_limited: "You're answering quickly — please wait a moment before sending another answer.",
  answer_too_long: "That answer is too long. Keep it under 3,000 characters.",
  llm_not_configured: "The AI interviewer isn't configured yet. Add GEMINI_API_KEY to the server environment.",
};

const STATUS_BY_CODE: Record<InterviewErrorCode, number> = {
  interview_not_found: 404,
  interview_already_completed: 409,
  interview_not_started: 409,
  evaluation_failed: 502,
  question_generation_failed: 502,
  report_generation_failed: 502,
  rate_limited: 429,
  answer_too_long: 413,
  llm_not_configured: 503,
};

export class InterviewError extends Error {
  readonly code: InterviewErrorCode;
  readonly httpStatus: number;

  constructor(code: InterviewErrorCode, options?: { cause?: unknown; message?: string }) {
    super(options?.message ?? DEFAULT_MESSAGES[code], { cause: options?.cause });
    this.name = "InterviewError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
  }
}

export class InterviewNotFoundError extends InterviewError {
  constructor(options?: { cause?: unknown }) {
    super("interview_not_found", options);
    this.name = "InterviewNotFoundError";
  }
}

export class InterviewAlreadyCompletedError extends InterviewError {
  constructor() {
    super("interview_already_completed");
    this.name = "InterviewAlreadyCompletedError";
  }
}

export class EvaluationError extends InterviewError {
  constructor(options?: { cause?: unknown }) {
    super("evaluation_failed", options);
    this.name = "EvaluationError";
  }
}

export class QuestionGenerationError extends InterviewError {
  constructor(options?: { cause?: unknown }) {
    super("question_generation_failed", options);
    this.name = "QuestionGenerationError";
  }
}

export class ReportGenerationError extends InterviewError {
  constructor(options?: { cause?: unknown }) {
    super("report_generation_failed", options);
    this.name = "ReportGenerationError";
  }
}

export class RateLimitError extends InterviewError {
  constructor() {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}

export class AnswerTooLongError extends InterviewError {
  constructor() {
    super("answer_too_long");
    this.name = "AnswerTooLongError";
  }
}
