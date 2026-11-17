import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import { parsedResumeSchema } from "@/lib/validation/resumeSchemas";
import type { Json } from "@/types/database";

export const resumeProfileStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type ResumeProfileStatus = (typeof resumeProfileStatuses)[number];

export interface ResumeProfileProps {
  id: string;
  user_id: string;
  resume_id: string;
  status: ResumeProfileStatus;
  error_message: string | null;
  raw_text: string | null;
  parsed: Json | null;
  created_at: string;
  updated_at: string;
}

export class ResumeProfile {
  readonly id: string;
  readonly userId: string;
  readonly resumeId: string;
  readonly status: ResumeProfileStatus;
  readonly errorMessage: string | null;
  readonly rawText: string | null;
  readonly parsed: ParsedResume | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: ResumeProfileProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.resumeId = props.resume_id;
    this.status = props.status;
    this.errorMessage = props.error_message;
    this.rawText = props.raw_text;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;

    // Rows are written by this app, but validating on read keeps a corrupt or
    // older payload from crashing the dashboard.
    const parsed = parsedResumeSchema.safeParse(props.parsed);
    this.parsed = parsed.success ? parsed.data : null;
  }
}
