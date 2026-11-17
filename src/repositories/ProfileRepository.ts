import { AppError } from "@/lib/errors/AppError";
import type { AboutYouValues } from "@/lib/validation/onboardingSchemas";
import { Profile, type CurrentStatus } from "@/models/Profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BaseRepository } from "./BaseRepository";

/** Read surface of the profile store consumed by guards and services. */
export interface IProfileRepository {
  getByUserId(userId: string): Promise<Profile>;
}

export class ProfileRepository extends BaseRepository implements IProfileRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getByUserId(userId: string): Promise<Profile> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) this.mapDbError(error);
    if (!data) throw new AppError("not_found");
    return new Profile({
      ...data,
      current_status: data.current_status as CurrentStatus | null,
    });
  }

  async updateAboutYou(userId: string, values: AboutYouValues): Promise<Profile> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        full_name: values.full_name,
        country: values.country,
        city: values.city,
        current_status: values.current_status,
      })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return new Profile({
      ...data,
      current_status: data.current_status as CurrentStatus | null,
    });
  }

  async updateProgress(userId: string, step: number): Promise<Profile> {
    await this.verifyUserSession(userId);
    const current = await this.getByUserId(userId);
    const { data, error } = await this.supabase
      .from("profiles")
      .update({ onboarding_step: Math.max(current.onboardingStep, step) })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return new Profile({
      ...data,
      current_status: data.current_status as CurrentStatus | null,
    });
  }

  async complete(userId: string): Promise<Profile> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("profiles")
      .update({ onboarding_completed: true, onboarding_step: 7 })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) this.mapDbError(error);
    return new Profile({
      ...data,
      current_status: data.current_status as CurrentStatus | null,
    });
  }
}
