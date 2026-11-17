import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EducationEntryValues } from "@/lib/validation/onboardingSchemas";
import { EducationEntry, type EducationLevel } from "@/models/EducationEntry";
import { BaseRepository } from "./BaseRepository";

export class EducationRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByUserId(userId: string): Promise<EducationEntry[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("education_entries")
      .select("*")
      .eq("user_id", userId)
      .order("start_year", { ascending: false });
    if (error) this.mapDbError(error);
    return data.map((row) => new EducationEntry({
      ...row,
      level: row.level as EducationLevel,
    }));
  }

  async replaceForUser(userId: string, items: readonly EducationEntryValues[]): Promise<void> {
    await this.verifyUserSession(userId);
    const load = () => this.listByUserId(userId);
    const insert = async (item: EducationEntryValues) => {
      const { data, error } = await this.supabase
        .from("education_entries")
        .insert({
          user_id: userId,
          level: item.level,
          institution: item.institution,
          field_of_study: item.field_of_study,
          start_year: item.start_year,
          end_year: item.end_year,
          is_current: item.is_current,
          grade: item.grade,
        })
        .select("*")
        .single();
      if (error) this.mapDbError(error);
      return { id: data.id };
    };
    const update = async (id: string, item: EducationEntryValues) => {
      const { error } = await this.supabase
        .from("education_entries")
        .update({
          level: item.level,
          institution: item.institution,
          field_of_study: item.field_of_study,
          start_year: item.start_year,
          end_year: item.end_year,
          is_current: item.is_current,
          grade: item.grade,
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    const remove = async (ids: string[]) => {
      const { error } = await this.supabase
        .from("education_entries")
        .delete()
        .in("id", ids)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    await this.replaceRows(items, load, insert, update, remove);
  }
}
