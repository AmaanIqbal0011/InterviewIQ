import { z } from "zod";
import { AuthGuard } from "@/guards/AuthGuard";
import { InterviewError, RateLimitError } from "@/lib/errors/InterviewError";
import { InterviewSession, type InterviewTurnResult } from "@/services/interview/InterviewSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLLMClientFromEnv } from "@/services/resume/llm/createLLMClient";
import type { LLMClient } from "@/services/resume/llm/LLMClient";

const answerRequestSchema = z.union([
  z.object({
    interviewId: z.string().min(1),
    answer_text: z.string().trim().min(1).max(3000),
  }),
  z.object({
    interviewId: z.string().min(1),
    action: z.literal("end"),
  }),
]);

const ANSWERS_PER_MINUTE = 10;

function toResponse(interviewId: string, result: InterviewTurnResult): Response {
  return Response.json({
    status: "saved",
    interviewId,
    completed: result.completed,
    nextQuestion: {
      questionText: result.nextQuestion.questionText,
      topic: result.nextQuestion.topic,
      fallback: result.nextQuestion.fallback,
      isFollowup: result.nextQuestion.isFollowup,
      isClosing: result.nextQuestion.isClosing,
      move: result.nextQuestion.move,
    },
    remainingSeconds: result.remainingSeconds,
    elapsedSeconds: result.elapsedSeconds,
    phase: result.phase,
  });
}

/**
 * POST /api/interview/[id]/answer
 *
 * Saves the current answer (or an explicit `action: "end"`) and returns the
 * interviewer's next line together with the authoritative remaining time and
 * phase. When the clock runs out the session closes itself: the answer is
 * kept, the closing line is generated and the interview is completed.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = answerRequestSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json(
        { error: "Provide a valid interview ID and answer." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const user = await new AuthGuard(supabase).requireUser();

    let llm: LLMClient;
    try {
      llm = createLLMClientFromEnv();
    } catch {
      throw new InterviewError("llm_not_configured");
    }

    const session = await InterviewSession.open({
      supabase,
      llm,
      userId: user.id,
      interviewId: body.data.interviewId,
    });

    if ("action" in body.data) {
      return toResponse(body.data.interviewId, await session.close());
    }

    await enforceRateLimit(supabase, body.data.interviewId);

    const result = await session.submitAnswer(body.data.answer_text);
    return toResponse(body.data.interviewId, result);
  } catch (error) {
    if (error instanceof InterviewError) {
      return Response.json({ error: error.message }, { status: error.httpStatus });
    }
    console.error("Failed to submit interview answer", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "We couldn't submit that answer. Please try again." },
      { status: 500 },
    );
  }
}

/** Keeps a runaway client from burning through the transcript in seconds. */
async function enforceRateLimit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  interviewId: string,
): Promise<void> {
  const { data: recent, error } = await supabase
    .from("interview_turns")
    .select("created_at")
    .eq("interview_id", interviewId)
    .gte("created_at", new Date(Date.now() - 60000).toISOString())
    .limit(ANSWERS_PER_MINUTE);

  if (error) throw new Error(`Rate limit query failed: ${error.message}`);
  if (recent && recent.length >= ANSWERS_PER_MINUTE) throw new RateLimitError();
}
