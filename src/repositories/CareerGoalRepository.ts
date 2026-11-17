import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CareerGoalValues } from "@/lib/validation/onboardingSchemas";
import {
  CareerGoal,
  type Difficulty,
  type ExperienceLevel,
  type InterviewType,
} from "@/models/CareerGoal";
import { BaseRepository } from "./BaseRepository";

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

  async upsert(userId: string, values: CareerGoalValues): Promise<CareerGoal> {
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
    });
  }
}
