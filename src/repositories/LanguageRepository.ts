import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LanguageEntryValues } from "@/lib/validation/onboardingSchemas";
import { LanguageSkill, type Proficiency } from "@/models/LanguageSkill";
import { BaseRepository } from "./BaseRepository";

export class LanguageRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByUserId(userId: string): Promise<LanguageSkill[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("language_skills")
      .select("*")
      .eq("user_id", userId)
      .order("language");
    if (error) this.mapDbError(error);
    return data.map((row) => new LanguageSkill({
      ...row,
      proficiency: row.proficiency as Proficiency,
    }));
  }

  async replaceForUser(userId: string, items: readonly LanguageEntryValues[]): Promise<void> {
    await this.verifyUserSession(userId);
    const load = () => this.listByUserId(userId);
    const insert = async (item: LanguageEntryValues) => {
      const { data, error } = await this.supabase
        .from("language_skills")
        .insert({
          user_id: userId,
          language: item.language,
          proficiency: item.proficiency,
          is_interview_language: item.is_interview_language,
        })
        .select("*")
        .single();
      if (error) this.mapDbError(error);
      return { id: data.id };
    };
    const update = async (id: string, item: LanguageEntryValues) => {
      const { error } = await this.supabase
        .from("language_skills")
        .update({
          language: item.language,
          proficiency: item.proficiency,
          is_interview_language: item.is_interview_language,
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    const remove = async (ids: string[]) => {
      const { error } = await this.supabase
        .from("language_skills")
        .delete()
        .in("id", ids)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    await this.replaceRows(items, load, insert, update, remove);
  }
}
