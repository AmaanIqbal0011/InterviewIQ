import type { ResumeInfo } from "@/models/ResumeInfo";

/** Safe, user-facing error raised by the client-side resume flow. */
export class ResumeClientError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ResumeClientError";
  }
}

interface ErrorPayload {
  readonly error?: unknown;
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as ErrorPayload).error;
  return typeof message === "string" && message.trim() ? message : null;
}

/** Talks to the resume route handlers. All parsing stays on the server. */
export class ResumeApiClient {
  async parse(resumeId: string): Promise<ResumeInfo> {
    const response = await fetch("/api/resume/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId }),
      cache: "no-store",
    });
    return this.read<ResumeInfo>(response);
  }

  async getStatus(): Promise<ResumeInfo> {
    const response = await fetch("/api/resume/status", { cache: "no-store" });
    return this.read<ResumeInfo>(response);
  }

  private async read<T>(response: Response): Promise<T> {
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ResumeClientError(
        readErrorMessage(payload) ?? "Something went wrong. Please try again.",
      );
    }

    return payload as T;
  }
}
