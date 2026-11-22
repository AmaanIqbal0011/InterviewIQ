import { z } from "zod";
import { calculateOverallScore } from "@/lib/scoring";
import type { InterviewConfig } from "@/lib/validation/interviewSchemas";
import type { LLMClient, LLMJsonRequest } from "@/services/resume/llm/LLMClient";
import type { CandidateProfile } from "./CandidateProfile";

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const MAX_TURNS_IN_PROMPT = 40;
const MAX_ANSWER_CHARS = 600;

/** One answered exchange from the finished transcript. */
export interface ReportTurn {
  readonly question: string;
  readonly answer: string | null;
  readonly topic: string | null;
  /** 0-10 from the per-answer evaluation, or null when unevaluated. */
  readonly score: number | null;
  readonly relevance: number | null;
  readonly depth: number | null;
  readonly clarity: number | null;
  readonly strengths: readonly string[];
  readonly gaps: readonly string[];
}

/** Per-question feedback shown under each transcript entry. */
export interface QuestionFeedback {
  readonly question: string;
  readonly topic: string | null;
  readonly score: number | null;
  readonly verdict: string;
}

/** Everything the report page renders, all derived from the full transcript. */
export interface GeneratedReport {
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  /** What to focus on next — the actionable part of the report. */
  readonly focusNext: readonly string[];
  readonly categoryScores: Readonly<Record<string, number>>;
  readonly questionFeedback: readonly QuestionFeedback[];
  readonly cvInsights: readonly string[];
  readonly overallScore: number;
  readonly durationSeconds: number;
  /** True when the model was unavailable and the deterministic path was used. */
  readonly fallback: boolean;
}

export interface ReportGeneratorOptions {
  readonly llm: LLMClient;
  readonly config: InterviewConfig;
  readonly profile: CandidateProfile;
  /** Whole seconds the session actually ran. */
  readonly durationSeconds: number;
}

const reportSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  strengths: z.array(z.string().trim().min(1).max(240)).max(8),
  weaknesses: z.array(z.string().trim().min(1).max(240)).max(8),
  focus_next: z.array(z.string().trim().min(1).max(240)).max(8),
  category_scores: z.record(z.string(), z.number().min(0).max(10)).optional().default({}),
  cv_insights: z.array(z.string().trim().min(1).max(240)).max(6).optional().default([]),
});

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    weaknesses: { type: "ARRAY", items: { type: "STRING" } },
    focus_next: { type: "ARRAY", items: { type: "STRING" } },
    category_scores: { type: "OBJECT", additionalProperties: { type: "NUMBER" } },
    cv_insights: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "strengths", "weaknesses", "focus_next"],
};

const OUTPUT_CONTRACT = `Exact JSON schema:
{"type":"object","properties":{"summary":{"type":"string"},"strengths":{"type":"array","items":{"type":"string"}},"weaknesses":{"type":"array","items":{"type":"string"}},"focus_next":{"type":"array","items":{"type":"string"}},"category_scores":{"type":"object","additionalProperties":{"type":"number"}},"cv_insights":{"type":"array","items":{"type":"string"}}},"required":["summary","strengths","weaknesses","focus_next"],"additionalProperties":false}

Rules: 3-5 items per list, each a concrete sentence (no "N/A"). category_scores keys are Relevance, Depth, Clarity, Structure with 0-10 values. cv_insights are observations comparing the answers against the candidate's CV (empty array when nothing notable).`;

/**
 * Turns the finished transcript plus the time actually spent into the report
 * the candidate reads: a narrative summary, strengths, weak areas and what to
 * focus on next.
 *
 * Scores and per-question feedback are computed in code from the transcript
 * so they always match what was said; only the narrative prose is model-written.
 */
export class ReportGenerator {
  private readonly llm: LLMClient;
  private readonly config: InterviewConfig;
  private readonly profile: CandidateProfile;
  private readonly durationSeconds: number;

  constructor(options: ReportGeneratorOptions) {
    this.llm = options.llm;
    this.config = options.config;
    this.profile = options.profile;
    this.durationSeconds = Math.max(0, Math.trunc(options.durationSeconds));
  }

  /** Builds the full report; falls back to a deterministic one if the model fails. */
  async generate(turns: readonly ReportTurn[]): Promise<GeneratedReport> {
    const answered = ReportGenerator.answeredOf(turns);
    if (answered.length === 0) return ReportGenerator.deterministic(turns, this.durationSeconds);

    const narrative = await this.requestNarrative(answered);
    if (narrative) {
      const base = ReportGenerator.base(answered, this.durationSeconds);
      return {
        ...base,
        summary: narrative.summary,
        strengths: narrative.strengths,
        weaknesses: narrative.weaknesses,
        focusNext: narrative.focus_next,
        categoryScores: { ...base.categoryScores, ...narrative.category_scores },
        cvInsights: narrative.cv_insights,
        fallback: false,
      };
    }

    return ReportGenerator.deterministic(turns, this.durationSeconds);
  }

  /**
   * A complete report built only from the transcript — no model, no config,
   * nothing that can throw. Used when generation fails outright so the page
   * still has something worth reading.
   */
  static deterministic(turns: readonly ReportTurn[], durationSeconds: number): GeneratedReport {
    const answered = ReportGenerator.answeredOf(turns);
    const base = ReportGenerator.base(answered, durationSeconds);

    if (answered.length === 0) {
      return {
        ...base,
        summary:
          "This session ended before any answer was recorded, so there is nothing to score yet. Start another interview and speak to the buzzer.",
        strengths: [],
        weaknesses: [],
        focusNext: ["Complete a full session so the report has answers to work with."],
        cvInsights: [],
        fallback: true,
      };
    }

    return {
      ...base,
      ...ReportGenerator.deterministicNarrative(answered),
      cvInsights: [],
      fallback: true,
    };
  }

  /** The parts every report shares, computed from the transcript itself. */
  private static base(
    answered: readonly ReportTurn[],
    durationSeconds: number,
  ): Pick<
    GeneratedReport,
    "questionFeedback" | "categoryScores" | "overallScore" | "durationSeconds"
  > {
    return {
      questionFeedback: ReportGenerator.buildQuestionFeedback(answered),
      categoryScores: ReportGenerator.averageCategories(answered),
      overallScore:
        calculateOverallScore(
          answered.map((turn) => (turn.score === null ? null : { score: turn.score })),
        ) ?? 0,
      durationSeconds,
    };
  }

  private static answeredOf(turns: readonly ReportTurn[]): ReportTurn[] {
    return turns.filter((turn) => turn.answer !== null);
  }

  // ---------------------------------------------------------------- internals

  private async requestNarrative(
    turns: readonly ReportTurn[],
  ): Promise<z.infer<typeof reportSchema> | null> {
    const request: LLMJsonRequest = {
      systemInstruction: `You are a senior interviewer writing a debrief after a live interview. Return ONLY the JSON object described below — no markdown, no prose around it.\n\n${OUTPUT_CONTRACT}`,
      prompt: this.buildPrompt(turns),
      jsonSchema: OUTPUT_SCHEMA,
      timeoutMs: TIMEOUT_MS,
    };

    let validationError = "";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const raw = await this.llm.generateJson(this.withCorrection(request, attempt, validationError));
        const parsed = reportSchema.parse(
          JSON.parse(ReportGenerator.extractJsonObject(raw)) as unknown,
        );
        return parsed;
      } catch (error) {
        validationError = ReportGenerator.describeError(error);
        if (attempt === MAX_ATTEMPTS - 1) {
          console.error("ReportGenerator failed; using deterministic report", {
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }
    }
    return null;
  }

  /** First attempt uses the prompt as-is; the retry explains what failed. */
  private withCorrection(
    request: LLMJsonRequest,
    attempt: number,
    validationError: string,
  ): LLMJsonRequest {
    if (attempt === 0) return request;
    return {
      ...request,
      prompt: `${request.prompt}\n\nCorrection: your previous response failed validation (${validationError}). Return only the required JSON object.`,
    };
  }

  private buildPrompt(turns: readonly ReportTurn[]): string {
    const recent = turns.slice(-MAX_TURNS_IN_PROMPT);
    const transcript = recent
      .map((turn, index) => {
        const answer = (turn.answer ?? "").slice(0, MAX_ANSWER_CHARS);
        const score = turn.score === null ? "n/a" : `${turn.score}/10`;
        return `${index + 1}. Interviewer (${turn.topic ?? "general"}): ${turn.question}\n   Candidate [${score}]: ${answer}`;
      })
      .join("\n");

    return `Write the debrief for this timed interview.

Role they interviewed for: ${this.config.target_role}
Interview type: ${this.config.interview_type} | difficulty: ${this.config.difficulty}
Length of session: ${Math.round(this.durationSeconds / 60)} minute(s) actually spent
Topics they asked to focus on: ${this.config.focus_topics.join(", ") || "none"}

Candidate profile the interviewer worked from:
${this.profile.describe()}

Transcript (last ${recent.length} of ${turns.length} exchanges):
${transcript}

Write:
- summary: 2-4 sentences on how the session went, in second person ("You…"), grounded in what was actually said.
- strengths: 3-5 specific things they did well, quoting the substance of their answers.
- weaknesses: 3-5 concrete gaps — vague answers, missing examples, thin detail.
- focus_next: 3-5 things to practice next, ordered by impact, specific enough to act on today.
- category_scores: Relevance, Depth, Clarity, Structure on 0-10, consistent with the per-answer scores above.
- cv_insights: how their answers lined up with their stated CV/profile (or an empty array).`;
  }

  /** Per-question verdicts straight from the stored evaluations. */
  private static buildQuestionFeedback(
    turns: readonly ReportTurn[],
  ): QuestionFeedback[] {
    return turns.map((turn) => ({
      question: turn.question,
      topic: turn.topic,
      score: turn.score,
      verdict: ReportGenerator.verdictFor(turn),
    }));
  }

  private static verdictFor(turn: ReportTurn): string {
    if (turn.gaps.length > 0) return turn.gaps[0];
    if (turn.strengths.length > 0) return turn.strengths[0];
    if (turn.score === null) return "Not scored.";
    if (turn.score >= 8) return "Strong, specific answer.";
    if (turn.score >= 5) return "Solid base — more detail would land it.";
    return "Needs concrete detail and examples.";
  }

  /** Mean of the per-answer relevance/depth/clarity scores, 0-10. */
  private static averageCategories(turns: readonly ReportTurn[]): Record<string, number> {
    const buckets: Record<string, { total: number; count: number }> = {
      Relevance: { total: 0, count: 0 },
      Depth: { total: 0, count: 0 },
      Clarity: { total: 0, count: 0 },
    };
    for (const turn of turns) {
      for (const [key, value] of [
        ["Relevance", turn.relevance],
        ["Depth", turn.depth],
        ["Clarity", turn.clarity],
      ] as const) {
        if (typeof value === "number" && Number.isFinite(value)) {
          buckets[key].total += value;
          buckets[key].count += 1;
        }
      }
    }

    const result: Record<string, number> = {};
    for (const [key, bucket] of Object.entries(buckets)) {
      if (bucket.count > 0) result[key] = Math.round((bucket.total / bucket.count) * 10) / 10;
    }
    return result;
  }

  /** Used when the model is unavailable: everything except the prose. */
  private static deterministicNarrative(turns: readonly ReportTurn[]): {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    focusNext: string[];
  } {
    const strengths = [...new Set(turns.flatMap((turn) => turn.strengths))].slice(0, 5);
    const weaknesses = [...new Set(turns.flatMap((turn) => turn.gaps))].slice(0, 5);
    const answered = turns.length;

    return {
      summary: `You worked through ${answered} ${answered === 1 ? "question" : "questions"} in this session. Scores and per-answer notes below are computed directly from your transcript; the written summary is unavailable right now, so lean on the sections underneath it.`,
      strengths:
        strengths.length > 0
          ? strengths
          : ["Stayed with the session and answered every question put to you."],
      weaknesses:
        weaknesses.length > 0
          ? weaknesses
          : ["Answers could carry more specific examples and measurable detail."],
      focusNext: [
        "Rehearse the STAR structure (Situation, Task, Action, Result) so answers stay concrete.",
        "Prepare one quantified example per skill listed on your CV.",
        "Practice the questions you scored lowest on and record yourself once.",
      ],
    };
  }

  private static extractJsonObject(rawText: string): string {
    const text = rawText.replace(/```(?:json)?/gi, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new SyntaxError("LLM output did not contain a JSON object.");
    }
    return text.slice(start, end + 1);
  }

  private static describeError(error: unknown): string {
    if (error instanceof z.ZodError) {
      return error.issues
        .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
    }
    return error instanceof Error ? error.message : "unknown error";
  }
}
