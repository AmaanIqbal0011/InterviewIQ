import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { WorkExperienceEntryValues } from "@/lib/validation/onboardingSchemas";
import { WorkExperience, type EmploymentType } from "@/models/WorkExperience";
import { BaseRepository } from "./BaseRepository";

export class WorkExperienceRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByUserId(userId: string): Promise<WorkExperience[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("work_experiences")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });
    if (error) this.mapDbError(error);
    return data.map((row) => new WorkExperience({
      ...row,
      employment_type: row.employment_type as EmploymentType,
    }));
  }

  async replaceForUser(userId: string, items: readonly WorkExperienceEntryValues[]): Promise<void> {
    await this.verifyUserSession(userId);
    const load = () => this.listByUserId(userId);
    const insert = async (item: WorkExperienceEntryValues) => {
      const { data, error } = await this.supabase
        .from("work_experiences")
        .insert({
          user_id: userId,
          job_title: item.job_title,
          company: item.company,
          employment_type: item.employment_type,
          start_date: item.start_date,
          end_date: item.end_date,
          is_current: item.is_current,
          description: item.description,
        })
        .select("*")
        .single();
      if (error) this.mapDbError(error);
      return { id: data.id };
    };
    const update = async (id: string, item: WorkExperienceEntryValues) => {
      const { error } = await this.supabase
        .from("work_experiences")
        .update({
          job_title: item.job_title,
          company: item.company,
          employment_type: item.employment_type,
          start_date: item.start_date,
          end_date: item.end_date,
          is_current: item.is_current,
          description: item.description,
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    const remove = async (ids: string[]) => {
      const { error } = await this.supabase
        .from("work_experiences")
        .delete()
        .in("id", ids)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    await this.replaceRows(items, load, insert, update, remove);
  }
}
