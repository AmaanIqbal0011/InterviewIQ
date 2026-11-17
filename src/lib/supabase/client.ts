import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components (sign out, resume upload).
 * `createBrowserClient` caches itself for the lifetime of the tab, so calling
 * this repeatedly always yields the same instance.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
