/** The name fields Supabase keeps on a user's `user_metadata`. */
export interface DisplayNameMetadata {
  readonly full_name?: unknown;
  readonly name?: unknown;
}

/**
 * Resolves the name to show for an account.
 *
 * Order: `user_metadata.full_name`, then `user_metadata.name`, then the part
 * of the email before "@". Returns "" only when the account has nothing
 * usable to display.
 */
export function resolveDisplayName(
  metadata: DisplayNameMetadata | null | undefined,
  email?: string | null,
): string {
  for (const candidate of [metadata?.full_name, metadata?.name]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const address = typeof email === "string" ? email.trim() : "";
  const [localPart = ""] = address.split("@");
  return localPart.length > 0 ? localPart : address;
}
