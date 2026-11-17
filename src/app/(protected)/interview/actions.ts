"use server";

import { AppError } from "@/lib/errors/AppError";
import { AuthError, mapSupabaseError } from "@/lib/errors/AuthError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInterviewService } from "@/services/interview/createInterviewService";
import { QuestionGenerator } from "@/lib/question_generator";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
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
 * Creates an interview row, generates the first question via QuestionGenerator,
 * and saves it as turn 0 in interview_turns.
 * Never redirects itself — the caller decides where to go.
 */
export async function createInterviewAction(
  rawConfig: unknown,
): Promise<CreateInterviewActionResult> {
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
    const interviewId = interview.id;

    // --- GENERATE FIRST QUESTION ---
    let llmClient: LLMClient;
    try {
      llmClient = createLLMClientFromEnv();
    } catch (llmError) {
      // If LLM client can't be created (missing API key/provider), throw a typed error
      console.error("LLM client configuration error", { error: llmError });
      return {
        ok: false,
        message:
          "Interview service is not configured. Please contact the administrator.",
      };
    }

    try {
      // Build the CandidateContext from the interview row's snapshot
      const { data: turnData } = await supabase
        .from("interviews")
        .select("context_snapshot")
        .eq("id", interviewId)
        .single();

      if (!turnData?.context_snapshot) {
        throw new Error("No context snapshot found for newly created interview");
      }

      const ctx = candidateContextSchema.parse(turnData.context_snapshot);
      const questionGenerator = new QuestionGenerator(
        llmClient,
        ctx,
        parsed.data,
      );

      const { questionText, topic, fallback } = await questionGenerator.generateMainQuestion([], []);

      // Save the first question as turn 0 in interview_turns
      const { error: turnError } = await supabase
        .from("interview_turns")
        .insert({
          interview_id: interviewId,
          turn_index: 0,
          question_type: "main",
          question_text: questionText,
          topic,
          answer_text: null,
          evaluation: { fallback },
        });

      if (turnError) {
        console.error("Failed to save first question turn", { error: turnError });
        // Roll back the interview if saving the turn fails
        await supabase.from("interviews").delete().eq("id", interviewId);
        return {
          ok: false,
          message:
            "Failed to save the first question. Please try again.",
        };
      }

      // Mark the interview as in_progress now that we have the first question
      await supabase
        .from("interviews")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", interviewId)
        .eq("user_id", user.id);

      return { ok: true, interviewId };
    } catch (genError) {
      // If first-question generation fails, roll back the interview
      console.error("First question generation failed", { error: genError, interviewId });
      try {
        await supabase.from("interviews").delete().eq("id", interviewId);
      } catch (rollbackError) {
        console.error("Failed to roll back interview", { error: rollbackError });
      }
      return {
        ok: false,
        message:
          "We couldn't generate the first question. Please try again.",
      };
    }
  } catch (error) {
    if (error instanceof AppError || error instanceof AuthError) {
      console.error("Create interview failed", { code: error.code });
      return { ok: false, message: error.message };
    }
    console.error("Create interview failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, message: "We couldn't start that interview. Please try again." };
  }
}