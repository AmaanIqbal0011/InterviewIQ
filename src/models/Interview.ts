import type { InterviewConfig } from "@/lib/validation/interviewSchemas";
import type { CandidateContext } from "@/lib/validation/candidateContextSchemas";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";
import type { Json } from "@/types/database";

export const interviewStatuses = ["setup", "in_progress", "completed", "abandoned"] as const;
export type InterviewStatus = (typeof interviewStatuses)[number];

export const reportStatuses = ["pending", "generating", "ready", "failed"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export interface InterviewProps {
  readonly id: string;
  readonly user_id: string;
  readonly role: string;
  readonly status: string;
  readonly config: Json | null;
  readonly context_snapshot: Json | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly overall_score: number | null;
  readonly report_status: string;
  readonly created_at: string;
}

/** One interview session owned by the signed-in user. */
export class Interview {
  readonly id: string;
  readonly userId: string;
  readonly role: string;
  readonly status: InterviewStatus;
  /** Validated session config; null only for rows written before migration 005. */
  readonly config: InterviewConfig | null;
  /** Frozen personalization snapshot taken when the session was created. */
  readonly contextSnapshot: CandidateContext | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly overallScore: number | null;
  readonly reportStatus: ReportStatus;
  readonly createdAt: string;

  constructor(props: InterviewProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.role = props.role;
    this.status = this.toStatus(props.status);
    this.config = this.toConfig(props.config);
    this.contextSnapshot = this.toContext(props.context_snapshot);
    this.startedAt = props.started_at;
    this.completedAt = props.completed_at;
    this.overallScore = props.overall_score;
    this.reportStatus = this.toReportStatus(props.report_status);
    this.createdAt = props.created_at;
  }

  /** Unknown database values degrade to a safe default rather than crashing. */
  private toStatus(value: string): InterviewStatus {
    return (interviewStatuses as readonly string[]).includes(value)
      ? (value as InterviewStatus)
      : "setup";
  }

  private toReportStatus(value: string): ReportStatus {
    return (reportStatuses as readonly string[]).includes(value)
      ? (value as ReportStatus)
      : "pending";
  }

  private toConfig(value: Json | null): InterviewConfig | null {
    const parsed = interviewConfigSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private toContext(value: Json | null): CandidateContext | null {
    const parsed = candidateContextSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
}
