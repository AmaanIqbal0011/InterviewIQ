import { z } from "zod";
import { AuthGuard } from "@/guards/AuthGuard";
import { AnswerEvaluator } from "@/lib/answer_evaluator";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { QuestionGenerator } from "@/lib/question_generator";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import { decideNextQuestionType } from "@/lib/interview_followup";
import { calculateOverallScore } from "@/lib/scoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLLMClientFromEnv } from "@/services/resume/llm/createLLMClient";

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

function completedResponse(interviewId: string): Response {
  return Response.json({
    status: "saved",
    interviewId,
    completed: true,
    nextQuestion: null,
  });
}

/** POST /api/interview/[id]/answer: save the current answer and generate one next question. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = answerRequestSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Provide a valid interview ID and answer." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const user = await new AuthGuard(supabase).requireUser();
    const { interviewId } = body.data;

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("user_id, config, context_snapshot, status")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview || interview.user_id !== user.id) {
      return Response.json(
        { error: "You don't have permission to answer this interview." },
        { status: 403 },
      );
    }

    if ("action" in body.data) {
      if (interview.status === "completed") return completedResponse(interviewId);
      if (interview.status !== "in_progress") {
        return Response.json({ error: "This interview is not in progress." }, { status: 409 });
      }

      const { data: turns, error: turnsError } = await supabase
        .from("interview_turns")
        .select("evaluation")
        .eq("interview_id", interviewId);
      if (turnsError) throw turnsError;
      const overallScore = calculateOverallScore((turns ?? []).map((turn) => turn.evaluation));

      const { data: updatedInterview, error: completionError } = await supabase
        .from("interviews")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          overall_score: overallScore,
        })
        .eq("id", interviewId)
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .select("id")
        .maybeSingle();

      if (completionError) throw completionError;
      if (updatedInterview) return completedResponse(interviewId);

      const { data: latestInterview, error: latestError } = await supabase
        .from("interviews")
        .select("status")
        .eq("id", interviewId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (latestError) throw latestError;
      if (latestInterview?.status === "completed") return completedResponse(interviewId);
      return Response.json({ error: "This interview is not in progress." }, { status: 409 });
    }

    if (interview.status !== "in_progress") {
      return Response.json({ error: "This interview is not in progress." }, { status: 409 });
    }

    const answerText = body.data.answer_text;

    const configResult = interviewConfigSchema.safeParse(interview.config);
    const contextResult = candidateContextSchema.safeParse(interview.context_snapshot);
    if (!configResult.success || !contextResult.success) {
      console.error("Interview question generation context is invalid", {
        interviewId,
        configInvalid: !configResult.success,
        contextInvalid: !contextResult.success,
      });
      return Response.json({ error: "Interview context is unavailable." }, { status: 500 });
    }

    const { data: recent } = await supabase
      .from("interview_turns")
      .select("created_at")
      .eq("interview_id", interviewId)
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .limit(10);

    if (recent && recent.length >= 10) {
      return Response.json({ error: "Too many answers. Please wait a moment." }, { status: 429 });
    }

    const { data: turns, error: turnsError } = await supabase
      .from("interview_turns")
      .select("id, turn_index, question_type, question_text, topic, answer_text, evaluation")
      .eq("interview_id", interviewId)
      .order("turn_index", { ascending: true });

    if (turnsError) throw turnsError;
    const currentTurn = turns?.find((turn) => turn.answer_text === null);
    if (!currentTurn) {
      return Response.json({ error: "There is no unanswered question." }, { status: 409 });
    }

    const llmClient = createLLMClientFromEnv();
    const evaluation = await new AnswerEvaluator(
      llmClient,
      contextResult.data,
      configResult.data,
    ).evaluate(answerText, currentTurn.topic ?? "general");
    const nextTurnIndex = currentTurn.turn_index + 1;
    const decision = decideNextQuestionType(
      (turns ?? []).map((turn) => ({ questionType: turn.question_type })),
      evaluation.score,
      answerText,
      Number(configResult.data.question_count),
    );

    const { data: savedTurn, error: saveError } = await supabase
      .from("interview_turns")
      .update({
        answer_text: answerText,
        evaluation: {
          score: evaluation.score,
          relevance: evaluation.relevance,
          depth: evaluation.depth,
          clarity: evaluation.clarity,
          strengths: evaluation.strengths,
          gaps: evaluation.gaps,
          suggestedFollowUp: evaluation.suggestedFollowUp ?? null,
          fallback: evaluation.fallback,
        },
      })
      .eq("id", currentTurn.id)
      .is("answer_text", null)
      .select("id")
      .maybeSingle();

    if (saveError || !savedTurn) {
      return Response.json({ error: "This answer was already submitted." }, { status: 409 });
    }

    if (decision.nextQuestionType === null) {
      const overallScore = calculateOverallScore(
        (turns ?? []).map((turn) =>
          turn.id === currentTurn.id ? evaluation : turn.evaluation,
        ),
      );
      const { error: completeError } = await supabase
        .from("interviews")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          overall_score: overallScore,
        })
        .eq("id", interviewId)
        .eq("user_id", user.id)
        .eq("status", "in_progress");
      if (completeError) throw completeError;
      return completedResponse(interviewId);
    }

    const previousTurns = (turns ?? []).map((turn) => ({
      questionText: turn.question_text,
      isFollowup: turn.question_type === "followup",
      answerText: turn.id === currentTurn.id ? answerText : turn.answer_text,
    }));
    const coveredTopics = (turns ?? [])
      .map((turn) => turn.topic)
      .filter((topic): topic is string => Boolean(topic));
    const questionGenerator = new QuestionGenerator(
      llmClient,
      contextResult.data,
      configResult.data,
    );
    const generated =
      decision.nextQuestionType === "followup"
        ? await questionGenerator.generateFollowup(
            answerText,
            currentTurn.topic ?? "general",
            coveredTopics,
          )
        : await questionGenerator.generateMainQuestion(previousTurns, coveredTopics);

    const { error: nextTurnError } = await supabase
      .from("interview_turns")
      .insert({
        interview_id: interviewId,
        turn_index: nextTurnIndex,
        question_type: decision.nextQuestionType,
        question_text: generated.questionText,
        topic: generated.topic,
        answer_text: null,
        evaluation: { fallback: generated.fallback },
      });

    if (nextTurnError) {
      const { error: rollbackError } = await supabase
        .from("interview_turns")
        .update({ answer_text: null })
        .eq("id", currentTurn.id)
        .eq("answer_text", answerText);
      if (rollbackError) {
        console.error("Failed to restore unanswered interview turn", {
          errorName: rollbackError.name,
        });
      }
      throw nextTurnError;
    }
    return Response.json({
      status: "saved",
      interviewId,
      completed: false,
      nextQuestion: {
        questionText: generated.questionText,
        topic: generated.topic,
        fallback: generated.fallback,
        isFollowup: generated.isFollowup,
      },
    });
  } catch (error) {
    console.error("Failed to submit interview answer", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "We couldn't submit that answer. Please try again." }, { status: 500 });
  }
}
