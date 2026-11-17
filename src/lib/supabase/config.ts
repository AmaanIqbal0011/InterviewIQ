export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * Reads only the public Supabase project settings used by the browser and
 * cookie-backed server client.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill it in.",
    );
  }
  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.",
    );
  }

  return { url, publishableKey };
}
