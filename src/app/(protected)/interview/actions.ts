"use server";

import { AppError } from "@/lib/errors/AppError";
import { AuthError, mapSupabaseError } from "@/lib/errors/AuthError";
import { InterviewError } from "@/lib/errors/InterviewError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInterviewService } from "@/services/interview/createInterviewService";
import { InterviewSession } from "@/services/interview/InterviewSession";
import { createLLMClientFromEnv } from "@/services/resume/llm/createLLMClient";
import type { LLMClient } from "@/services/resume/llm/LLMClient";

export type CreateInterviewActionResult =
  | { readonly ok: true; readonly interviewId: string }
  | { readonly ok: false; readonly message: string; readonly fieldErrors?: Record<string, string> };

function invalidResult(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }): CreateInterviewActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return {
    ok: false,
    message: "Please review your answers and try again.",
    fieldErrors,
  };
}

/**
 * Creates the interview row and lets the session open it with a greeting and
 * the first question (turn 0), then marks it in progress.
 * Never redirects itself — the caller decides where to go.
 */
export async function createInterviewAction(
  rawConfig: unknown,
): Promise<CreateInterviewActionResult> {
  let interviewId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const authError = error ? mapSupabaseError(error) : new AuthError("unknown");
      return { ok: false, message: authError.message };
    }

    const service = createInterviewService(supabase);
    const { interviewConfigSchema } = await import("@/lib/validation/interviewSchemas");
    const parsed = interviewConfigSchema.safeParse(rawConfig);
    if (!parsed.success) return invalidResult(parsed.error);

    const interview = await service.createInterview(user.id, parsed.data);
    interviewId = interview.id;

    let llmClient: LLMClient;
    try {
      llmClient = createLLMClientFromEnv();
    } catch (llmError) {
      console.error("LLM client configuration error", { error: llmError });
      await rollbackInterview(supabase, interview.id);
      return {
        ok: false,
        message: "Interview service is not configured. Please contact the administrator.",
      };
    }

    try {
      const session = await InterviewSession.open({
        supabase,
        llm: llmClient,
        userId: user.id,
        interviewId: interview.id,
      });
      await session.start();
      return { ok: true, interviewId: interview.id };
    } catch (startError) {
      console.error("Interview opening failed", {
        interviewId: interview.id,
        errorName: startError instanceof Error ? startError.name : "UnknownError",
      });
      await rollbackInterview(supabase, interview.id);
      return {
        ok: false,
        message:
          startError instanceof InterviewError
            ? startError.message
            : "We couldn't generate the first question. Please try again.",
      };
    }
  } catch (error) {
    if (error instanceof AppError || error instanceof AuthError || error instanceof InterviewError) {
      console.error("Create interview failed", { code: error.code });
      return { ok: false, message: error.message };
    }
    console.error("Create interview failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (interviewId !== null) {
      // Nothing may survive a half-started session.
      console.error("Rolling back half-created interview", { interviewId });
    }
    return { ok: false, message: "We couldn't start that interview. Please try again." };
  }
}

/** Removes a row whose opening could not be produced, so no ghost sessions linger. */
async function rollbackInterview(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  interviewId: string,
): Promise<void> {
  try {
    const { error } = await supabase.from("interviews").delete().eq("id", interviewId);
    if (error) console.error("Failed to roll back interview", { errorCode: error.code });
  } catch (rollbackError) {
    console.error("Failed to roll back interview", { rollbackError });
  }
}
