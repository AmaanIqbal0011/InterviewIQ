import type {
  PostgrestError,
  SupabaseClient,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import { AppError } from "@/lib/errors/AppError";
import { AuthError, mapSupabaseError } from "@/lib/errors/AuthError";
import type { Database } from "@/types/database";

export abstract class BaseRepository {
  protected readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  protected async verifyUserSession(userId: string): Promise<SupabaseUser> {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) {
      throw mapSupabaseError(error);
    }
    if (!user || user.id !== userId) {
      throw new AuthError("unknown");
    }
    return user;
  }

  protected mapDbError(error: PostgrestError): never {
    console.error("Database operation failed", {
      code: error.code || "unknown",
      message: error.message || "Supabase returned an error without a message.",
      details: error.details || "not provided",
      hint: error.hint || "not provided",
    });
    throw new AppError("database", { cause: error });
  }

  protected async replaceRows<Row extends { id: string }, Item extends { id?: string }>(
    items: readonly Item[],
    load: () => Promise<Row[]>,
    insert: (item: Item) => Promise<Pick<Row, "id">>,
    update: (id: string, item: Item) => Promise<void>,
    remove: (ids: string[]) => Promise<void>,
  ): Promise<void> {
    const providedIds = items.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(providedIds).size !== providedIds.length) {
      throw new AppError("invalid_input");
    }

    const existing = await load();
    const existingIds = new Set(existing.map((row) => row.id));
    const retainedIds = new Set<string>();

    for (const item of items) {
      if (item.id) {
        if (!existingIds.has(item.id)) {
          throw new AppError("not_found");
        }
        await update(item.id, item);
        retainedIds.add(item.id);
      } else {
        const row = await insert(item);
        retainedIds.add(row.id);
      }
    }

    const removedIds = existing.filter((row) => !retainedIds.has(row.id)).map((row) => row.id);
    if (removedIds.length > 0) {
      await remove(removedIds);
    }
  }
}
