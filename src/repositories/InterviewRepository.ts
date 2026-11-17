import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateContext } from "@/lib/validation/candidateContextSchemas";
import type { InterviewConfig } from "@/lib/validation/interviewSchemas";
import type { Database, Json } from "@/types/database";
import { Interview, type InterviewStatus, type ReportStatus } from "@/models/Interview";
import { BaseRepository } from "./BaseRepository";

/** Aggregate view of a user's interview history for dashboard stats. */
export interface InterviewStats {
  readonly totalInterviews: number;
  /** Mean of scored completed interviews, or null when none carry a score. */
  readonly averageScore: number | null;
  /** ISO timestamp of the most recent interview, or null when there are none. */
  readonly lastInterviewAt: string | null;
}

export interface CreateInterviewInput {
  readonly role: string;
  readonly config: InterviewConfig;
  readonly contextSnapshot: CandidateContext;
}

/** Write-capable interview store consumed by InterviewService. */
export interface IInterviewRepository {
  getRecentByUser(userId: string, limit: number): Promise<Interview[]>;
  getAllByUser(userId: string): Promise<Interview[]>;
  getStats(userId: string): Promise<InterviewStats>;
  findByIdForUser(userId: string, interviewId: string): Promise<Interview | null>;
  create(userId: string, input: CreateInterviewInput): Promise<Interview>;
  markInProgress(userId: string, interviewId: string): Promise<void>;
  markCompleted(
    userId: string,
    interviewId: string,
    overallScore: number | null,
  ): Promise<void>;
  setReportStatus(
    userId: string,
    interviewId: string,
    status: ReportStatus,
  ): Promise<void>;
}

export class InterviewRepository extends BaseRepository implements IInterviewRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getRecentByUser(userId: string, limit: number): Promise<Interview[]> {
    await this.verifyUserSession(userId);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const { data, error } = await this.supabase
      .from("interviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) this.mapDbError(error);
    return data.map((row) => new Interview(row));
  }

  async getAllByUser(userId: string): Promise<Interview[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) this.mapDbError(error);
    return data.map((row) => new Interview(row));
  }

  async getStats(userId: string): Promise<InterviewStats> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interviews")
      .select("overall_score, created_at, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) this.mapDbError(error);

    const scored = data.filter(
      (row): row is { overall_score: number; created_at: string; status: string } =>
        row.status === "completed" && typeof row.overall_score === "number",
    );
    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, row) => sum + row.overall_score, 0) / scored.length
        : null;

    return {
      totalInterviews: data.length,
      averageScore,
      lastInterviewAt: data[0]?.created_at ?? null,
    };
  }

  async findByIdForUser(userId: string, interviewId: string): Promise<Interview | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interviews")
      .select("*")
      .eq("id", interviewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) this.mapDbError(error);
    return data ? new Interview(data) : null;
  }

  async create(userId: string, input: CreateInterviewInput): Promise<Interview> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interviews")
      .insert({
        user_id: userId,
        role: input.role,
        status: "setup",
        config: input.config as unknown as Json,
        context_snapshot: input.contextSnapshot as unknown as Json,
        started_at: null,
        completed_at: null,
        overall_score: null,
        report_status: "pending",
      })
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return new Interview(data);
  }

  async markInProgress(userId: string, interviewId: string): Promise<void> {
    await this.verifyUserSession(userId);
    // started_at is only set on the first transition so a refresh never
    // restarts the clock; completed rows are never downgraded.
    const { error } = await this.supabase
      .from("interviews")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", interviewId)
      .eq("user_id", userId)
      .eq("status", "setup");
    if (error) this.mapDbError(error);
  }

  async markCompleted(
    userId: string,
    interviewId: string,
    overallScore: number | null,
  ): Promise<void> {
    await this.verifyUserSession(userId);
    const { error } = await this.supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        overall_score: overallScore,
      })
      .eq("id", interviewId)
      .eq("user_id", userId)
      .in("status", ["setup", "in_progress"]);
    if (error) this.mapDbError(error);
  }

  async setReportStatus(
    userId: string,
    interviewId: string,
    status: ReportStatus,
  ): Promise<void> {
    await this.verifyUserSession(userId);
    const { error } = await this.supabase
      .from("interviews")
      .update({ report_status: status })
      .eq("id", interviewId)
      .eq("user_id", userId);
    if (error) this.mapDbError(error);
  }
}

export type { InterviewStatus };
