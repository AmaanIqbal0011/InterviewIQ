import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import { Resume } from "@/models/Resume";
import {
  ResumeProfile,
  type ResumeProfileStatus,
} from "@/models/ResumeProfile";
import type { Database, Json } from "@/types/database";
import { BaseRepository } from "./BaseRepository";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ResumeProfileRow = Database["public"]["Tables"]["resume_profiles"]["Row"];

export interface CreateResumeRecordInput {
  readonly filePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface UpsertResumeProfileInput {
  readonly status: ResumeProfileStatus;
  readonly errorMessage?: string | null;
  readonly rawText?: string | null;
  readonly parsed?: ParsedResume | null;
}

/** All database access for `resumes` and `resume_profiles`. */
export interface IResumeRepository {
  listByUserId(userId: string): Promise<Resume[]>;
  findLatestByUserId(userId: string): Promise<Resume | null>;
  findByIdForUser(userId: string, resumeId: string): Promise<Resume | null>;
  insert(userId: string, input: CreateResumeRecordInput): Promise<Resume>;
  deleteById(userId: string, resumeId: string): Promise<void>;
  deleteAllExcept(userId: string, keepResumeId: string): Promise<Resume[]>;
  findProfileByResumeId(
    userId: string,
    resumeId: string,
  ): Promise<ResumeProfile | null>;
  upsertProfile(
    userId: string,
    resumeId: string,
    input: UpsertResumeProfileInput,
  ): Promise<ResumeProfile>;
}

export class ResumeRepository extends BaseRepository implements IResumeRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByUserId(userId: string): Promise<Resume[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("resumes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) this.mapDbError(error);
    return (data ?? []).map((row) => this.toResume(row));
  }

  async findLatestByUserId(userId: string): Promise<Resume | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("resumes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) this.mapDbError(error);
    return data ? this.toResume(data) : null;
  }

  async findByIdForUser(userId: string, resumeId: string): Promise<Resume | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) this.mapDbError(error);
    return data ? this.toResume(data) : null;
  }

  async insert(userId: string, input: CreateResumeRecordInput): Promise<Resume> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("resumes")
      .insert({
        user_id: userId,
        file_path: input.filePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size: input.size,
      })
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return this.toResume(data);
  }

  async deleteById(userId: string, resumeId: string): Promise<void> {
    await this.verifyUserSession(userId);
    const { error } = await this.supabase
      .from("resumes")
      .delete()
      .eq("id", resumeId)
      .eq("user_id", userId);
    if (error) this.mapDbError(error);
  }

  async deleteAllExcept(userId: string, keepResumeId: string): Promise<Resume[]> {
    const resumes = await this.listByUserId(userId);
    const stale = resumes.filter((resume) => resume.id !== keepResumeId);
    if (stale.length === 0) return [];

    const { error } = await this.supabase
      .from("resumes")
      .delete()
      .eq("user_id", userId)
      .in(
        "id",
        stale.map((resume) => resume.id),
      );
    if (error) this.mapDbError(error);
    return stale;
  }

  async findProfileByResumeId(
    userId: string,
    resumeId: string,
  ): Promise<ResumeProfile | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("resume_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("resume_id", resumeId)
      .maybeSingle();
    if (error) this.mapDbError(error);
    return data ? this.toResumeProfile(data) : null;
  }

  async upsertProfile(
    userId: string,
    resumeId: string,
    input: UpsertResumeProfileInput,
  ): Promise<ResumeProfile> {
    await this.verifyUserSession(userId);

    const payload: Database["public"]["Tables"]["resume_profiles"]["Insert"] = {
      user_id: userId,
      resume_id: resumeId,
      status: input.status,
    };

    if (input.errorMessage !== undefined) {
      payload.error_message = input.errorMessage;
    }
    if (input.rawText !== undefined) {
      payload.raw_text = input.rawText;
    }
    if (input.parsed !== undefined) {
      payload.parsed = input.parsed === null ? null : (input.parsed as unknown as Json);
    }

    const { data, error } = await this.supabase
      .from("resume_profiles")
      .upsert(payload, { onConflict: "resume_id" })
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return this.toResumeProfile(data);
  }

  private toResume(row: ResumeRow): Resume {
    return new Resume(row);
  }

  private toResumeProfile(row: ResumeProfileRow): ResumeProfile {
    return new ResumeProfile({
      ...row,
      status: row.status as ResumeProfileStatus,
    });
  }
}
