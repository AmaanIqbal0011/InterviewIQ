import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { InterviewTurn } from "@/models/InterviewTurn";
import { BaseRepository } from "./BaseRepository";
import { mapSupabaseError } from "@/lib/errors/AuthError";

type InterviewTurnRow = {
  id: string;
  interview_id: string;
  turn_index: number;
  question_type: string;
  question_text: string;
  topic: string | null;
  answer_text: string | null;
  evaluation: Json | null;
  created_at: string;
};

export interface IInterviewTurnRepository {
  listByInterview(userId: string, interviewId: string): Promise<InterviewTurn[]>;
  listRecent(userId: string, limit?: number): Promise<InterviewTurn[]>;
  insertTurn(userId: string, interviewId: string, turnIndex: number, questionType: string, questionText: string, topic?: string): Promise<InterviewTurn>;
  getTurn(userId: string, interviewId: string, turnIndex: number): Promise<InterviewTurn | null>;
  updateEvaluation(userId: string, interviewId: string, turnIndex: number, evaluation: Json): Promise<void>;
}

export class InterviewTurnRepository extends BaseRepository implements IInterviewTurnRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByInterview(userId: string, interviewId: string): Promise<InterviewTurn[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interview_turns")
      .select("*")
      .eq("interview_id", interviewId)
      .order("turn_index", { ascending: true });
    if (error) throw mapSupabaseError(error);
    return data.map((row: InterviewTurnRow) => new InterviewTurn({
      id: row.id,
      interviewId: row.interview_id,
      turnIndex: row.turn_index,
      questionType: row.question_type,
      questionText: row.question_text,
      topic: row.topic,
      answerText: row.answer_text,
      evaluation: row.evaluation,
      createdAt: row.created_at,
    }));
  }

  async listRecent(userId: string, limit: number = 10): Promise<InterviewTurn[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interview_turns")
      .select("*, interviews(user_id)")
      .eq("interviews.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw mapSupabaseError(error);
    return data.map((row: InterviewTurnRow) => new InterviewTurn({
      id: row.id,
      interviewId: row.interview_id,
      turnIndex: row.turn_index,
      questionType: row.question_type,
      questionText: row.question_text,
      topic: row.topic,
      answerText: row.answer_text,
      evaluation: row.evaluation,
      createdAt: row.created_at,
    }));
  }

  async insertTurn(userId: string, interviewId: string, turnIndex: number, questionType: string, questionText: string, topic?: string): Promise<InterviewTurn> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interview_turns")
      .insert({
        interview_id: interviewId,
        turn_index: turnIndex,
        question_type: questionType,
        question_text: questionText,
        topic: topic ?? null,
        answer_text: null,
        evaluation: null,
      })
      .select("*")
      .single();
    if (error) throw mapSupabaseError(error);
    return new InterviewTurn({
      id: data.id,
      interviewId: data.interview_id,
      turnIndex: data.turn_index,
      questionType: data.question_type,
      questionText: data.question_text,
      topic: data.topic,
      answerText: data.answer_text,
      evaluation: data.evaluation,
      createdAt: data.created_at,
    });
  }

  async getTurn(userId: string, interviewId: string, turnIndex: number): Promise<InterviewTurn | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("interview_turns")
      .select("*")
      .eq("interview_id", interviewId)
      .eq("turn_index", turnIndex)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? new InterviewTurn({
      id: data.id,
      interviewId: data.interview_id,
      turnIndex: data.turn_index,
      questionType: data.question_type,
      questionText: data.question_text,
      topic: data.topic,
      answerText: data.answer_text,
      evaluation: data.evaluation,
      createdAt: data.created_at,
    }) : null;
  }

  async updateEvaluation(userId: string, interviewId: string, turnIndex: number, evaluation: Json): Promise<void> {
    await this.verifyUserSession(userId);
    const { error } = await this.supabase
      .from("interview_turns")
      .update({ evaluation })
      .eq("interview_id", interviewId)
      .eq("turn_index", turnIndex);
    if (error) throw mapSupabaseError(error);
  }
}