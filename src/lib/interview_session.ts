// InterviewSession - manages the state of an interview session
// Strict OOP, constructor injection, no `any`
// Tracks progress, stores answers, determines when interview is complete

import {
  decideNextQuestionType,
  type InterviewQuestionTurn,
} from "@/lib/interview_followup";

export type InterviewStatus = "setup" | "in_progress" | "completed" | "abandoned";

export interface InterviewSessionState {
  interviewId: string;
  status: InterviewStatus;
  questionIndex: number;
  answers: Array<{
    questionId: string;
    answer: string;
    evaluation: EvaluationResult;
  }>;
  scores: Array<{ questionId: string; score: number; feedback: string }>;
}

export interface InterviewSessionOptions {
  questionCount: number;
  includeFollowups: boolean;
  topicWhitelist: string[];
}

export interface GeneratedQuestion {
  id: string;
  questionType: "main" | "followup";
  questionText: string;
  topic: string | null;
  isFollowup: boolean;
}

export interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export class InterviewSession {
  public readonly questionCount: number;
  public readonly includeFollowups: boolean;
  public readonly topicWhitelist: string[];

  private readonly skills: ReadonlyArray<string>;
  private readonly resumeSummary: string | null;
  private answers: Array<{
    questionId: string;
    answer: string;
    evaluation: EvaluationResult;
  }>;
  private scores: Array<{ questionId: string; score: number; feedback: string }>;
  private questionIndex: number;

  constructor(
    skills: ReadonlyArray<string>,
    resumeSummary: string | null,
    topicWhitelist: string[],
    questionCount: number,
    includeFollowups: boolean = false
  ) {
    this.skills = skills;
    this.resumeSummary = resumeSummary;
    this.topicWhitelist = topicWhitelist;
    this.questionCount = questionCount;
    this.includeFollowups = includeFollowups;
    this.questionIndex = 0;
    this.answers = [];
    this.scores = [];
  }

  /** Get the current state of the interview session. */
  getState(): InterviewSessionState {
    return {
      interviewId: "interview-" + Math.random(),
      status: "in_progress",
      questionIndex: this.questionIndex,
      answers: [...this.answers],
      scores: [...this.scores],
    };
  }

  /** Generate a main question or the follow-up selected from persisted history. */
  generateQuestion(
    isFollowup = false,
  ): { question: GeneratedQuestion; evaluation: EvaluationResult | null } {
    const evaluation: EvaluationResult | null = null;
    const prevTopic = this.answers[this.answers.length - 1]?.questionId || "technical";
    const question: GeneratedQuestion =
      this.includeFollowups && isFollowup
        ? {
            id: "q-followup-" + Math.random(),
            questionType: "followup",
            questionText: `Follow-up about: ${prevTopic}`,
            topic: prevTopic,
            isFollowup: true,
          }
        : {
            id: "q-main-" + Math.random(),
            questionType: "main",
            questionText: "Tell me about your experience",
            topic: this.topicWhitelist[0] || null,
            isFollowup: false,
          };

    this.questionIndex++;
    return { question, evaluation };
  }

  /** Evaluate a candidate's answer and advance using persisted interview turns.
   */
  evaluateAnswer(
    questionId: string,
    answer: string,
    persistedTurns: readonly InterviewQuestionTurn[],
  ): {
    evaluation: EvaluationResult;
    needsFollowup: boolean;
    followupCount: number;
    nextQuestionType: "main" | "followup" | null;
  } {
    const relevantSkills = this.findRelevantSkills(answer);
    const score = this.determineScore(answer, relevantSkills);
    const feedback = this.generateFeedback(answer, relevantSkills);
    const strengths = this.extractStrengths(answer, relevantSkills);
    const improvements = this.extractImprovements(answer, relevantSkills);

    const evaluation: EvaluationResult = { score, feedback, strengths, improvements };

    // Store the answer and evaluation
    this.answers.push({
      questionId,
      answer,
      evaluation,
    });
    this.scores.push({
      questionId,
      score,
      feedback,
    });

    const decision = decideNextQuestionType(
      persistedTurns,
      this.includeFollowups ? score / 10 : 10,
      answer,
      this.questionCount,
    );

    this.questionIndex++;
    return {
      evaluation,
      needsFollowup: decision.needsFollowup,
      followupCount: decision.followupCount,
      nextQuestionType: decision.nextQuestionType,
    };
  }

  /** Mark the interview as complete and return the final state. */
  complete(): InterviewSessionState {
    return {
      interviewId: "",
      status: "completed",
      questionIndex: this.questionIndex,
      answers: [...this.answers],
      scores: [...this.scores],
    };
  }

  private findRelevantSkills(answer: string): ReadonlyArray<string> {
    return this.skills.filter((s: string) => answer.toLowerCase().includes(s.toLowerCase()));
  }

  private determineScore(answer: string, relevantSkills: ReadonlyArray<string>): number {
    const answerLength = answer.length;
    let score = Math.min(50, Math.max(0, Math.round((answerLength / 2000) * 50)));
    if (relevantSkills.length > 0) score = Math.min(100, score + 30);
    const wordCount = answer.trim().split(/\s+/).length;
    if (wordCount > 50) score = Math.min(100, score + 20);
    if (wordCount < 20) score = Math.max(0, score - 10);
    return score;
  }

  private generateFeedback(answer: string, relevantSkills: ReadonlyArray<string>): string {
    const lines: string[] = [];
    if (answer.length > 100) {
      lines.push("Good detail provided in your answer.");
    } else {
      lines.push("Consider providing more detail in future answers.");
    }
    if (relevantSkills.length > 0) {
      lines.push("You effectively referenced relevant skills.");
    } else {
      lines.push("Try mentioning relevant skills from your background.");
    }
    lines.push(`Your response was about: ${this.topicWhitelist?.[0] || "technical skills"}.`);
    return lines.join(" ");
  }

  private extractStrengths(answer: string, relevantSkills: ReadonlyArray<string>): string[] {
    const strengths: string[] = [];
    if (answer.length > 100) strengths.push("Provided detailed response");
    if (relevantSkills.length > 0) strengths.push("Referenced relevant skills");
    if (answer.trim().split(/\s+/).length > 30) strengths.push("Comprehensive answer");
    return strengths;
  }

  private extractImprovements(answer: string, relevantSkills: ReadonlyArray<string>): string[] {
    const improvements: string[] = [];
    if (answer.length < 50) improvements.push("Expand your answer with more detail");
    if (relevantSkills.length === 0) improvements.push("Mention relevant skills from your background");
    if (answer.trim().split(/\s+/).length < 20) improvements.push("Provide more substantial answers");
    return improvements;
  }
}