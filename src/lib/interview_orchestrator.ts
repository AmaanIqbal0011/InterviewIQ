// InterviewOrchestrator - orchestrates the full interview flow
// Strict OOP, constructor injection, no `any`
// Coordinates question generation, answer evaluation, and session completion

import { InterviewSession } from "@/lib/interview_session";
import type { InterviewQuestionTurn } from "@/lib/interview_followup";

export type InterviewStatus = "setup" | "in_progress" | "completed" | "abandoned";

export interface OrchestratorState {
  readonly status: InterviewStatus;
  readonly currentQuestionIndex: number;
  readonly totalQuestions: number;
  readonly answers: Array<{
    questionId: string;
    answer: string;
    evaluation: EvaluationResult;
  }>;
}

export interface OrchestratorOptions {
  readonly questionCount: number;
  readonly includeFollowups: boolean;
  readonly topicWhitelist: string[];
}

export interface EvaluationResult {
  readonly score: number;
  readonly feedback: string;
  readonly strengths: string[];
  readonly improvements: string[];
}

export class InterviewOrchestrator {
  private readonly session: InterviewSession;

  constructor(
    skills: ReadonlyArray<string>,
    resumeSummary: string | null,
    options: OrchestratorOptions
  ) {
    this.session = new InterviewSession(
      skills,
      resumeSummary,
      options.topicWhitelist,
      options.questionCount,
      options.includeFollowups
    );
  }

  /** Get the current orchestrator state. */
  getState(): OrchestratorState {
    const state = this.session.getState();
    return {
      status: state.status,
      currentQuestionIndex: state.questionIndex,
      totalQuestions: this.session.questionCount,
      answers: state.answers,
    };
  }

  /** Generate the next question for the interview (main or follow-up). */
  generateQuestion(): { question: { id: string; text: string; isFollowup: boolean }; evaluation: EvaluationResult | null } {
    const result = this.session.generateQuestion();
    return {
      question: {
        id: result.question.id,
        text: result.question.questionText,
        isFollowup: result.question.isFollowup,
      },
      evaluation: result.evaluation,
    };
  }

  /** Evaluate a candidate's answer and advance to the next question.
   *  Decides follow-up vs next question based on includeFollowups flag, score, and question count.
   *  Low score (<= 3) or very short answer (< 20 chars) triggers a follow-up (max 2 per main question).
   */
  evaluateAnswer(
    questionId: string,
    answer: string,
    persistedTurns: readonly InterviewQuestionTurn[],
  ): {
    evaluation: EvaluationResult;
    next: boolean;
    newQuestion: { id: string; text: string; isFollowup: boolean } | null;
  } {
    const { evaluation, needsFollowup, nextQuestionType } =
      this.session.evaluateAnswer(questionId, answer, persistedTurns);

    let newQuestion: { id: string; text: string; isFollowup: boolean } | null = null;
    if (nextQuestionType !== null) {
      const result = this.session.generateQuestion(needsFollowup);
      newQuestion = {
        id: result.question.id,
        text: result.question.questionText,
        isFollowup: result.question.isFollowup,
      };
    }

    return {
      evaluation,
      next: nextQuestionType !== null,
      newQuestion,
    };
  }

  /** Complete the interview and return the final state. */
  complete(): OrchestratorState {
    const sessionState = this.session.complete();
    return {
      status: sessionState.status,
      currentQuestionIndex: sessionState.questionIndex,
      totalQuestions: this.session.questionCount,
      answers: sessionState.answers,
    };
  }
}