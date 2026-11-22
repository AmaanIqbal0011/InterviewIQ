import type { SupabaseClient } from "@supabase/supabase-js";
import { AnswerEvaluator, type EvaluationResult } from "@/lib/answer_evaluator";
import { InterviewError, InterviewNotFoundError } from "@/lib/errors/InterviewError";
import { calculateOverallScore } from "@/lib/scoring";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { interviewConfigSchema, type InterviewConfig } from "@/lib/validation/interviewSchemas";
import type { LLMClient } from "@/services/resume/llm/LLMClient";
import type { Database, Json } from "@/types/database";
import { CandidateProfile } from "./CandidateProfile";
import { InterviewerPersona } from "./InterviewerPersona";
import {
  InterviewPromptBuilder,
  type InterviewMove,
  type PromptTurn,
} from "./InterviewPromptBuilder";
import { InterviewTimer, type InterviewPhase } from "./InterviewTimer";
import { InterviewTurnGenerator, type GeneratedTurn } from "./InterviewTurnGenerator";

export interface InterviewSessionOptions {
  readonly supabase: SupabaseClient<Database>;
  readonly llm: LLMClient;
  readonly userId: string;
  readonly interviewId: string;
  /** Frozen request clock so one request sees one consistent "now" (tests inject it). */
  readonly nowMs?: number;
}

/** The interviewer's next line, shaped for the API response. */
export interface NextTurnPayload {
  readonly questionText: string;
  readonly topic: string | null;
  readonly fallback: boolean;
  readonly isFollowup: boolean;
  readonly isClosing: boolean;
  readonly move: InterviewMove;
}

/** Result of answering, closing or starting a session. */
export interface InterviewTurnResult {
  readonly completed: boolean;
  /** Always present: the next question, or the closing line once completed. */
  readonly nextQuestion: NextTurnPayload;
  readonly phase: InterviewPhase;
  readonly remainingSeconds: number;
  readonly elapsedSeconds: number;
}

type InterviewRow = {
  user_id: string;
  status: string;
  config: Json | null;
  context_snapshot: Json | null;
  started_at: string | null;
  completed_at: string | null;
};

type TurnRow = {
  readonly id: string;
  readonly turn_index: number;
  readonly question_type: string;
  readonly question_text: string;
  readonly topic: string | null;
  readonly answer_text: string | null;
  readonly evaluation: Json | null;
};

type TurnEvaluation = {
  readonly move?: string;
  readonly fallback?: boolean;
  readonly questionFallback?: boolean;
  readonly score?: number;
};

/**
 * The live interview session: owns the timer, the persona, the candidate
 * profile, the prompt builder and the Supabase transcript.
 *
 * One instance == one request against one interview row. Every phase decision
 * (opening, main, wrap-up, ended) is derived server-side from `started_at`
 * plus the configured duration, so the browser can never extend the session.
 */
export class InterviewSession {
  private readonly supabase: SupabaseClient<Database>;
  private readonly userId: string;
  private readonly interviewId: string;
  private readonly nowMs: number | undefined;
  private readonly row: InterviewRow;
  private readonly turns: TurnRow[];
  private readonly persona: InterviewerPersona;
  private readonly profile: CandidateProfile;
  private readonly promptBuilder: InterviewPromptBuilder;
  private readonly generator: InterviewTurnGenerator;
  private readonly evaluator: AnswerEvaluator;
  private readonly config: InterviewConfig;
  private readonly durationSeconds: number;
  private openingComplete: boolean;

  private constructor(options: InterviewSessionOptions, row: InterviewRow, turns: TurnRow[]) {
    this.supabase = options.supabase;
    this.userId = options.userId;
    this.interviewId = options.interviewId;
    this.nowMs = options.nowMs;
    this.row = row;
    this.turns = turns;

    const config = interviewConfigSchema.parse(row.config);
    const context = candidateContextSchema.parse(row.context_snapshot);

    this.config = config;
    this.persona = InterviewerPersona.forInterview(config);
    this.profile = CandidateProfile.fromContext(context);
    this.promptBuilder = new InterviewPromptBuilder({
      outputContract: InterviewTurnGenerator.OUTPUT_CONTRACT,
    });
    this.generator = new InterviewTurnGenerator(options.llm);
    this.evaluator = new AnswerEvaluator(options.llm, context, config);
    this.durationSeconds = InterviewTimer.durationSecondsFor(config);
    this.openingComplete = turns.some((turn) => turn.answer_text !== null);
  }

  /** Loads the interview and its transcript; throws when it is missing or not yours. */
  static async open(options: InterviewSessionOptions): Promise<InterviewSession> {
    const { supabase, userId, interviewId } = options;

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("user_id, status, config, context_snapshot, started_at, completed_at")
      .eq("id", interviewId)
      .eq("user_id", userId)
      .maybeSingle();

    if (interviewError) throw InterviewSession.dbError(interviewError);
    if (!interview) throw new InterviewNotFoundError();

    const configResult = interviewConfigSchema.safeParse(interview.config);
    const contextResult = candidateContextSchema.safeParse(interview.context_snapshot);
    if (!configResult.success || !contextResult.success) {
      throw new InterviewError("interview_context_invalid");
    }

    const { data: turns, error: turnsError } = await supabase
      .from("interview_turns")
      .select("id, turn_index, question_type, question_text, topic, answer_text, evaluation")
      .eq("interview_id", interviewId)
      .order("turn_index", { ascending: true });

    if (turnsError) throw InterviewSession.dbError(turnsError);

    return new InterviewSession(options, interview, turns ?? []);
  }

  /** Current phase, recomputed from the server clock on every access. */
  get phase(): InterviewPhase {
    return this.timer.phase;
  }

  get remainingSeconds(): number {
    return this.timer.remainingSeconds;
  }

  get elapsedSeconds(): number {
    return this.timer.elapsedSeconds;
  }

  get isCompleted(): boolean {
    return this.row.status === "completed";
  }

  /** Generates the greeting + first question and marks the session in progress. */
  async start(): Promise<InterviewTurnResult> {
    if (this.row.status === "completed") {
      throw new InterviewError("interview_already_completed");
    }
    if (this.turns.length > 0) {
      throw new InterviewError("interview_not_started", {
        message: "This interview has already started.",
      });
    }

    const generated = await this.generateTurn(["open"], "OPENING");
    await this.insertTurn(generated, 0);

    const { error } = await this.supabase
      .from("interviews")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", this.interviewId)
      .eq("user_id", this.userId)
      .eq("status", "setup");

    if (error) throw InterviewSession.dbError(error);

    this.row.status = "in_progress";
    this.row.started_at = this.row.started_at ?? new Date(this.nowMs ?? Date.now()).toISOString();
    this.turns.push(this.toTurnRow(generated, 0));

    return this.result(generated);
  }

  /** Records the candidate's answer, then produces the interviewer's next line. */
  async submitAnswer(answerText: string): Promise<InterviewTurnResult> {
    if (this.row.status === "completed") {
      throw new InterviewError("interview_already_completed");
    }
    if (this.row.status !== "in_progress") {
      throw new InterviewError("interview_not_started");
    }

    const current = this.openTurn();
    if (!current) {
      throw new InterviewError("interview_not_started", {
        message: "There is no unanswered question.",
      });
    }

    const evaluation = await this.evaluator.evaluate(answerText, current.topic ?? "general");
    const saved = await this.saveAnswer(current, answerText, evaluation);
    if (!saved) {
      throw new InterviewError("answer_already_submitted");
    }

    this.openingComplete = true;

    // Time may well have run out while the model was reading the answer —
    // the answer is kept, and the conversation closes instead of moving on.
    if (this.timer.phase === "ENDED") {
      return this.finish();
    }

    const generated = await this.generateTurn(this.movesForNextTurn(), this.timer.phase);
    const index = this.nextTurnIndex();
    await this.insertTurn(generated, index);
    this.turns.push(this.toTurnRow(generated, index));

    return this.result(generated);
  }

  /**
   * Ends the session: thanks the candidate, saves the closing line and
   * completes the interview. Idempotent — a second call returns the same
   * closing line.
   */
  async close(): Promise<InterviewTurnResult> {
    if (this.row.status === "completed") {
      const existing = this.findClosingTurn();
      if (existing) return this.resultFromTurn(existing);
      // Completed by an older build: give them a closing line without writing.
      return {
        completed: true,
        nextQuestion: {
          questionText: this.persona.closing(this.profile.firstName),
          topic: null,
          fallback: true,
          isFollowup: false,
          isClosing: true,
          move: "closing",
        },
        phase: "ENDED",
        remainingSeconds: 0,
        elapsedSeconds: this.elapsedSeconds,
      };
    }
    return this.finish();
  }

  // ---------------------------------------------------------------- internals

  private get timer(): InterviewTimer {
    return new InterviewTimer({
      durationSeconds: this.durationSeconds,
      startedAt: this.row.started_at,
      nowMs: this.nowMs,
      completed: this.row.status === "completed",
      openingComplete: this.openingComplete,
    });
  }

  /** Opening, then one question or a follow-up — never a scripted list. */
  private movesForNextTurn(): readonly InterviewMove[] {
    const phase = this.timer.phase;
    if (phase !== "WRAP_UP") return this.promptBuilder.allowedMoves(phase);
    const alreadyAskedFinalQuestion = this.turns.some(
      (turn) => this.evaluationOf(turn).move === "wrap_up",
    );
    return alreadyAskedFinalQuestion ? ["closing"] : ["wrap_up", "closing"];
  }

  private async generateTurn(
    allowedMoves: readonly InterviewMove[],
    phase: InterviewPhase,
  ): Promise<GeneratedTurn> {
    const context = this.promptContext(phase);
    return this.generator.generate({
      systemPrompt: this.promptBuilder.buildSystemPrompt(context),
      userPrompt: this.promptBuilder.buildUserPrompt(context),
      allowedMoves,
      phase,
      persona: this.persona,
      profile: this.profile,
    });
  }

  /** Closing line, persisted turn, completion and score — in that order. */
  private async finish(): Promise<InterviewTurnResult> {
    const generated = await this.generateTurn(["closing"], "ENDED");
    let closingTurn = this.findClosingTurn();

    if (!closingTurn) {
      const index = this.nextTurnIndex();
      await this.insertTurn(generated, index);
      closingTurn = this.toTurnRow(generated, index);
      this.turns.push(closingTurn);
    }

    await this.completeInterview();
    return this.resultFromTurn(closingTurn);
  }

  private async completeInterview(): Promise<void> {
    const overallScore = calculateOverallScore(
      this.turns.map((turn) => turn.evaluation),
    );

    const { error } = await this.supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        overall_score: overallScore,
      })
      .eq("id", this.interviewId)
      .eq("user_id", this.userId)
      .in("status", ["setup", "in_progress"]);

    if (error) throw InterviewSession.dbError(error);
    this.row.status = "completed";
  }

  private promptContext(phase: InterviewPhase) {
    return {
      persona: this.persona,
      profile: this.profile,
      timer: this.timer,
      config: this.config,
      coveredTopics: this.coveredTopics(),
      history: this.history(),
      phase,
    };
  }

  private coveredTopics(): string[] {
    return this.turns
      .filter((turn) => {
        const move = this.evaluationOf(turn).move;
        return move !== "wrap_up" && move !== "closing";
      })
      .map((turn) => turn.topic)
      .filter((topic): topic is string => Boolean(topic));
  }

  private history(): PromptTurn[] {
    return this.turns.map((turn) => ({
      move: (this.evaluationOf(turn).move as InterviewMove | undefined) ?? null,
      question: turn.question_text,
      answer: turn.answer_text,
    }));
  }

  private openTurn(): TurnRow | undefined {
    return this.turns.find((turn) => turn.answer_text === null);
  }

  private findClosingTurn(): TurnRow | undefined {
    return this.turns.find((turn) => this.evaluationOf(turn).move === "closing");
  }

  private nextTurnIndex(): number {
    return this.turns.reduce((max, turn) => Math.max(max, turn.turn_index), -1) + 1;
  }

  /** Persists the answer and its evaluation; false when someone beat us to it. */
  private async saveAnswer(
    current: TurnRow,
    answerText: string,
    evaluation: EvaluationResult,
  ): Promise<boolean> {
    const previous = this.evaluationOf(current);
    const payload = {
      ...previous,
      score: evaluation.score,
      relevance: evaluation.relevance,
      depth: evaluation.depth,
      clarity: evaluation.clarity,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      suggestedFollowUp: evaluation.suggestedFollowUp ?? null,
      fallback: evaluation.fallback,
      move: previous.move ?? null,
      questionFallback: previous.questionFallback ?? previous.fallback ?? false,
    };

    const { data, error } = await this.supabase
      .from("interview_turns")
      .update({ answer_text: answerText, evaluation: payload as unknown as Json })
      .eq("id", current.id)
      .is("answer_text", null)
      .select("id")
      .maybeSingle();

    if (error) throw InterviewSession.dbError(error);
    if (!data) return false;

    const index = this.turns.indexOf(current);
    if (index >= 0) {
      this.turns[index] = { ...current, answer_text: answerText, evaluation: payload as Json };
    }
    return true;
  }

  private async insertTurn(turn: GeneratedTurn, turnIndex: number): Promise<void> {
    const { error } = await this.supabase.from("interview_turns").insert({
      interview_id: this.interviewId,
      turn_index: turnIndex,
      question_type: InterviewSession.toQuestionType(turn.move),
      question_text: turn.text,
      topic: turn.topic,
      answer_text: null,
      evaluation: { fallback: turn.fallback, move: turn.move } as unknown as Json,
    });

    if (error) throw InterviewSession.dbError(error);
  }

  private toTurnRow(turn: GeneratedTurn, turnIndex: number): TurnRow {
    return {
      id: `local-${turnIndex}`,
      turn_index: turnIndex,
      question_type: InterviewSession.toQuestionType(turn.move),
      question_text: turn.text,
      topic: turn.topic,
      answer_text: null,
      evaluation: { fallback: turn.fallback, move: turn.move },
    };
  }

  private result(generated: GeneratedTurn): InterviewTurnResult {
    const timer = this.timer;
    return {
      completed: false,
      nextQuestion: {
        questionText: generated.text,
        topic: generated.topic,
        fallback: generated.fallback,
        isFollowup: generated.move === "probe",
        isClosing: generated.move === "closing",
        move: generated.move,
      },
      phase: timer.phase,
      remainingSeconds: timer.remainingSeconds,
      elapsedSeconds: timer.elapsedSeconds,
    };
  }

  private resultFromTurn(turn: TurnRow): InterviewTurnResult {
    const move = (this.evaluationOf(turn).move as InterviewMove | undefined) ?? "question";
    const isClosing = move === "closing";
    const timer = this.timer;
    return {
      completed: isClosing,
      nextQuestion: {
        questionText: turn.question_text,
        topic: turn.topic,
        fallback: this.evaluationOf(turn).questionFallback ?? this.evaluationOf(turn).fallback ?? false,
        isFollowup: move === "probe",
        isClosing,
        move,
      },
      phase: timer.phase,
      remainingSeconds: isClosing ? 0 : timer.remainingSeconds,
      elapsedSeconds: timer.elapsedSeconds,
    };
  }

  private evaluationOf(turn: TurnRow): TurnEvaluation {
    const value = turn.evaluation;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value as TurnEvaluation;
  }

  private static dbError(error: { message: string; code?: string }): Error {
    const failure = new Error(error.message || "Database request failed");
    failure.name = "InterviewSessionDbError";
    if (error.code) failure.message = `${error.code}: ${error.message}`;
    return failure;
  }

  /** The two `question_type` values the schema allows, mapped from the move. */
  private static toQuestionType(move: InterviewMove): "main" | "followup" {
    return move === "probe" || move === "closing" ? "followup" : "main";
  }
}
