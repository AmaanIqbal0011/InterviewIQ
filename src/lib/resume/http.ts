import { ResumeError } from "@/lib/errors/ResumeError";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export function jsonOk<T>(data: T): Response {
  return Response.json(data, { headers: NO_STORE });
}

/** Maps pipeline errors to safe HTTP responses; never logs file contents. */
export function resumeErrorResponse(error: unknown): Response {
  if (error instanceof ResumeError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.httpStatus, headers: NO_STORE },
    );
  }

  console.error("Resume API failed", {
    reason: error instanceof Error ? error.name : "unknown",
  });
  return jsonError("Something went wrong. Please try again.", 500);
}
