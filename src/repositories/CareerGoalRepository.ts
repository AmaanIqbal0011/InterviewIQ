import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  CareerGoal,
  type Difficulty,
  type ExperienceLevel,
  type InterviewType,
  type PracticeGoal,
} from "@/models/CareerGoal";
import { BaseRepository } from "./BaseRepository";

export interface CareerGoalUpsertValues {
  target_role: string;
  target_industry: string | null;
  experience_level: ExperienceLevel;
  target_companies: string[];
  interview_type: InterviewType;
  difficulty: Difficulty;
  interview_language: string;
  practice_goals: PracticeGoal[];
  additional_notes: string | null;
}

export class CareerGoalRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getByUserId(userId: string): Promise<CareerGoal | null> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("career_goals")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) this.mapDbError(error);
    if (!data) return null;
    return this.toModel(data);
  }

  async upsert(userId: string, values: CareerGoalUpsertValues): Promise<CareerGoal> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("career_goals")
      .upsert({ user_id: userId, ...values }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return this.toModel(data);
  }

  private toModel(row: Database["public"]["Tables"]["career_goals"]["Row"]): CareerGoal {
    return new CareerGoal({
      ...row,
      experience_level: row.experience_level as ExperienceLevel,
      interview_type: row.interview_type as InterviewType,
      difficulty: row.difficulty as Difficulty,
      practice_goals: row.practice_goals as PracticeGoal[],
    });
  }
}
