import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import { createLLMClientFromEnv } from "@/services/resume/llm/createLLMClient";
import type { LLMClient } from "@/services/resume/llm/LLMClient";
import type { Database, Json } from "@/types/database";
import { CandidateProfile } from "./CandidateProfile";
import { InterviewTimer } from "./InterviewTimer";
import { ReportGenerator, type GeneratedReport, type ReportTurn } from "./ReportGenerator";

type InterviewRow = {
  readonly status: string;
  readonly config: Json | null;
  readonly context_snapshot: Json | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly report_status: string;
};

type TurnRow = {
  readonly question_text: string;
  readonly topic: string | null;
  readonly answer_text: string | null;
  readonly evaluation: Json | null;
};

type EvaluationView = {
  readonly score?: number;
  readonly relevance?: number;
  readonly depth?: number;
  readonly clarity?: number;
  readonly strengths?: unknown;
  readonly gaps?: unknown;
};

/** A stored report row, shaped for the report page. */
export interface StoredReport {
  readonly summary: string | null;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly focusNext: readonly string[];
  readonly categoryScores: Readonly<Record<string, number>>;
  readonly questionFeedback: readonly {
    readonly question: string;
    readonly topic: string | null;
    readonly score: number | null;
    readonly verdict: string;
  }[];
  readonly cvInsights: readonly string[];
  readonly overallScore: number;
  readonly durationSeconds: number;
  readonly fallback: boolean;
}

export interface ReportServiceOptions {
  readonly supabase: SupabaseClient<Database>;
  readonly userId: string;
  readonly interviewId: string;
  /** Injected so tests never need a real provider key. */
  readonly llm?: LLMClient;
}

/**
 * Owns the report lifecycle: reads the finished transcript, generates the
 * narrative once, and persists it behind `interviews.report_status` so a
 * refresh (or two tabs) never regenerates or duplicates the row.
 */
export class ReportService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly userId: string;
  private readonly interviewId: string;
  private readonly llm: LLMClient | undefined;

  constructor(options: ReportServiceOptions) {
    this.supabase = options.supabase;
    this.userId = options.userId;
    this.interviewId = options.interviewId;
    this.llm = options.llm;
  }

  /**
   * Returns the stored report, generating it on first view. Returns null when
   * the interview is not finished yet or the data needed to write one is gone.
   */
  async ensureReport(): Promise<StoredReport | null> {
    const interview = await this.loadInterview();
    if (!interview) return null;
    if (interview.status !== "completed") return null;

    const existing = await this.loadReport();
    if (existing && interview.report_status === "ready") return existing;

    // Claim the generation slot; a concurrent request that loses this update
    // simply reads the row the winner wrote.
    if (interview.report_status !== "generating") {
      const claimed = await this.setReportStatus("generating");
      if (!claimed) return existing;
    }

    try {
      const turns = await this.loadTurns();
      const generated = await this.buildReport(interview, turns);
      const saved = await this.saveReport(generated);
      await this.setReportStatus("ready");
      return saved ?? existing ?? ReportService.toStored(generated);
    } catch (error) {
      console.error("Report generation failed", {
        interviewId: this.interviewId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      // Nothing that can throw here: the page still gets a usable report.
      const fallback = await this.buildDeterministicReport(interview);
      if (fallback) {
        const saved = await this.saveReport(fallback);
        try {
          await this.setReportStatus("ready");
        } catch {
          // Status is bookkeeping; the row itself is what the page reads.
        }
        return saved ?? ReportService.toStored(fallback);
      }
      try {
        await this.setReportStatus(existing ? "ready" : "failed");
      } catch {
        // Same: a stale status must not mask the real failure.
      }
      // A previously stored report is still worth reading.
      return existing;
    }
  }

  // ---------------------------------------------------------------- internals

  private async loadInterview(): Promise<InterviewRow | null> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select("status, config, context_snapshot, started_at, completed_at, report_status")
      .eq("id", this.interviewId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw new Error(`Interview query failed: ${error.message}`);
    return data;
  }

  private async loadReport(): Promise<StoredReport | null> {
    const { data, error } = await this.supabase
      .from("interview_reports")
      .select("*")
      .eq("interview_id", this.interviewId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw new Error(`Report query failed: ${error.message}`);
    if (!data) return null;

    return {
      summary: data.summary,
      strengths: ReportService.toStringArray(data.strengths),
      weaknesses: ReportService.toStringArray(data.weaknesses),
      focusNext: ReportService.toStringArray(data.improvement_plan),
      categoryScores: ReportService.toScoreMap(data.category_scores),
      questionFeedback: ReportService.toFeedbackList(data.question_feedback),
      cvInsights: ReportService.toStringArray(data.cv_insights),
      overallScore: data.overall_score,
      durationSeconds: data.duration_seconds,
      fallback: false,
    };
  }

  private async loadTurns(): Promise<TurnRow[]> {
    const { data, error } = await this.supabase
      .from("interview_turns")
      .select("question_text, topic, answer_text, evaluation")
      .eq("interview_id", this.interviewId)
      .order("turn_index", { ascending: true });

    if (error) throw new Error(`Turn query failed: ${error.message}`);
    return data ?? [];
  }

  private async buildReport(
    interview: InterviewRow,
    turns: readonly TurnRow[],
  ): Promise<GeneratedReport> {
    const config = interviewConfigSchema.parse(interview.config);
    const context = candidateContextSchema.parse(interview.context_snapshot);
    const llm = this.llm ?? createLLMClientFromEnv();

    const durationSeconds = ReportService.elapsedSeconds(
      interview,
      InterviewTimer.durationSecondsFor(config),
    );

    const generator = new ReportGenerator({
      llm,
      config,
      profile: CandidateProfile.fromContext(context),
      durationSeconds,
    });

    return generator.generate(ReportService.toReportTurns(turns));
  }

  /**
   * Last resort when generation blows up: scores and notes straight from the
   * transcript, needing neither the config, the context nor a model.
   */
  private async buildDeterministicReport(interview: InterviewRow): Promise<GeneratedReport | null> {
    try {
      const turns = await this.loadTurns();
      const durationSeconds = ReportService.elapsedSeconds(
        interview,
        ReportService.configuredSeconds(interview),
      );
      return ReportGenerator.deterministic(ReportService.toReportTurns(turns), durationSeconds);
    } catch {
      return null;
    }
  }

  /** Configured session length; 0 when the stored config cannot be read. */
  private static configuredSeconds(interview: InterviewRow): number {
    try {
      return InterviewTimer.durationSecondsFor(interviewConfigSchema.parse(interview.config));
    } catch {
      return 0;
    }
  }

  private async saveReport(report: GeneratedReport): Promise<StoredReport | null> {
    const { error } = await this.supabase.from("interview_reports").upsert(
      {
        interview_id: this.interviewId,
        user_id: this.userId,
        overall_score: report.overallScore,
        category_scores: report.categoryScores as unknown as Json,
        strengths: [...report.strengths] as unknown as Json,
        weaknesses: [...report.weaknesses] as unknown as Json,
        question_feedback: [...report.questionFeedback] as unknown as Json,
        improvement_plan: [...report.focusNext] as unknown as Json,
        cv_insights: [...report.cvInsights] as unknown as Json,
        duration_seconds: report.durationSeconds,
        summary: report.summary,
      },
      { onConflict: "interview_id", ignoreDuplicates: false },
    );

    if (error) {
      console.error("Failed to persist interview report", { errorCode: error.code });
      return null;
    }
    return ReportService.toStored(report);
  }

  /**
   * Optimistic claim of the `generating` slot; false when someone else owns it.
   * `ready` is claimable too: it only means "a row exists", and a missing row
   * (a failed write on a previous attempt) is exactly what needs regenerating.
   */
  private async setReportStatus(status: "generating" | "ready" | "failed"): Promise<boolean> {
    const from =
      status === "generating" ? ["pending", "failed", "ready"] : ["generating", "pending", "failed"];
    const { data, error } = await this.supabase
      .from("interviews")
      .update({ report_status: status })
      .eq("id", this.interviewId)
      .eq("user_id", this.userId)
      .in("report_status", from)
      .select("id");

    if (error) throw new Error(`Report status update failed: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  /** Time actually spent: started → completed, capped at the configured length. */
  private static elapsedSeconds(interview: InterviewRow, durationSeconds: number): number {
    if (!interview.started_at) return 0;
    const end = interview.completed_at ? new Date(interview.completed_at).getTime() : Date.now();
    const started = new Date(interview.started_at).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(end)) return 0;
    return Math.max(0, Math.min(durationSeconds, Math.round((end - started) / 1000)));
  }

  private static toReportTurns(turns: readonly TurnRow[]): ReportTurn[] {
    return turns.map((turn) => {
      const evaluation = ReportService.evaluationOf(turn.evaluation);
      return {
        question: turn.question_text,
        answer: turn.answer_text,
        topic: turn.topic,
        score: typeof evaluation.score === "number" ? evaluation.score : null,
        relevance: typeof evaluation.relevance === "number" ? evaluation.relevance : null,
        depth: typeof evaluation.depth === "number" ? evaluation.depth : null,
        clarity: typeof evaluation.clarity === "number" ? evaluation.clarity : null,
        strengths: ReportService.toStringArray(evaluation.strengths),
        gaps: ReportService.toStringArray(evaluation.gaps),
      };
    });
  }

  private static evaluationOf(value: Json | null): EvaluationView {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value as EvaluationView;
  }

  private static toStored(report: GeneratedReport): StoredReport {
    return {
      summary: report.summary,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      focusNext: report.focusNext,
      categoryScores: report.categoryScores,
      questionFeedback: report.questionFeedback,
      cvInsights: report.cvInsights,
      overallScore: report.overallScore,
      durationSeconds: report.durationSeconds,
      fallback: report.fallback,
    };
  }

  private static toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }

  private static toScoreMap(value: unknown): Record<string, number> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const result: Record<string, number> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "number" && Number.isFinite(entry)) result[key] = entry;
    }
    return result;
  }

  private static toFeedbackList(value: unknown): StoredReport["questionFeedback"] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      if (typeof record.question !== "string") return [];
      return [
        {
          question: record.question,
          topic: typeof record.topic === "string" ? record.topic : null,
          score: typeof record.score === "number" ? record.score : null,
          verdict: typeof record.verdict === "string" ? record.verdict : "",
        },
      ];
    });
  }
}
