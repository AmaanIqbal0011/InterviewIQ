import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SkillEntryValues } from "@/lib/validation/onboardingSchemas";
import { Skill, type SkillCategory, type SkillLevel } from "@/models/Skill";
import { BaseRepository } from "./BaseRepository";

export class SkillRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async listByUserId(userId: string): Promise<Skill[]> {
    await this.verifyUserSession(userId);
    const { data, error } = await this.supabase
      .from("skills")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) this.mapDbError(error);
    return data.map((row) => new Skill({
      ...row,
      category: row.category as SkillCategory,
      level: row.level as SkillLevel,
    }));
  }

  async replaceForUser(userId: string, items: readonly SkillEntryValues[]): Promise<void> {
    await this.verifyUserSession(userId);
    const load = () => this.listByUserId(userId);
    const insert = async (item: SkillEntryValues) => {
      const { data, error } = await this.supabase
        .from("skills")
        .insert({
          user_id: userId,
          name: item.name,
          category: item.category,
          level: item.level,
        })
        .select("*")
        .single();
      if (error) this.mapDbError(error);
      return { id: data.id };
    };
    const update = async (id: string, item: SkillEntryValues) => {
      const { error } = await this.supabase
        .from("skills")
        .update({ name: item.name, category: item.category, level: item.level })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    const remove = async (ids: string[]) => {
      const { error } = await this.supabase
        .from("skills")
        .delete()
        .in("id", ids)
        .eq("user_id", userId);
      if (error) this.mapDbError(error);
    };
    await this.replaceRows(items, load, insert, update, remove);
  }
}
