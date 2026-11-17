import { isAuthError } from "@supabase/supabase-js";

/** Form field an authentication error can be attached to. */
export type AuthFieldName =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "acceptedTerms";

/**
 * Stable, UI-safe error codes. Supabase messages never reach the screen —
 * they are translated into one of these first.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "email_rate_limit"
  | "weak_password"
  | "email_not_confirmed"
  | "network"
  | "terms_not_accepted"
  | "validation"
  | "unknown";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: "That email and password combination doesn't match any account.",
  email_taken: "An account with that email already exists. Try logging in instead.",
  email_rate_limit: "Too many confirmation emails have been sent. Please wait before trying again.",
  weak_password: "Please choose a stronger password.",
  email_not_confirmed: "Your email address isn't confirmed yet. Check your inbox before logging in.",
  network: "We couldn't reach the server. Check your connection and try again.",
  terms_not_accepted: "Please accept the Terms & Conditions to continue.",
  validation: "Please fix the highlighted fields and try again.",
  unknown: "Something went wrong. Please try again.",
};

const NETWORK_PATTERN = /(fetch|network|econn|etimedout|load failed|socket)/i;

/** Authentication failure carrying a message that is always safe to display. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** Field to surface the message next to, when the failure maps to one. */
  readonly field: AuthFieldName | null;

  constructor(code: AuthErrorCode, options?: { field?: AuthFieldName; cause?: unknown }) {
    super(
      AUTH_ERROR_MESSAGES[code],
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "AuthError";
    this.code = code;
    this.field = options?.field ?? null;
  }
}

/** True when Supabase simply had no session to read (not a real failure). */
export function isSessionMissingError(error: unknown): boolean {
  if (!isAuthError(error)) {
    return false;
  }
  return error.code === "session_missing" || /session missing/i.test(error.message);
}

/**
 * Translates any thrown Supabase or transport failure into a friendly
 * {@link AuthError}. Unknown failures collapse to a generic message so raw
 * provider text is never shown to the user.
 */
export function mapSupabaseError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  if (isAuthError(error)) {
    const code = typeof error.code === "string" ? error.code : "";
    const message = error.message.toLowerCase();

    switch (code) {
      case "invalid_credentials":
        return new AuthError("invalid_credentials", { cause: error });
      case "user_exists":
      case "email_exists":
      case "user_already_exists":
        return new AuthError("email_taken", { field: "email", cause: error });
      case "over_email_send_rate_limit":
        return new AuthError("email_rate_limit", { cause: error });
      case "weak_password":
        return new AuthError("weak_password", { field: "password", cause: error });
      case "email_not_confirmed":
        return new AuthError("email_not_confirmed", { cause: error });
      default:
        break;
    }

    if (message.includes("invalid login credentials")) {
      return new AuthError("invalid_credentials", { cause: error });
    }
    if (message.includes("already registered") || message.includes("already been registered")) {
      return new AuthError("email_taken", { field: "email", cause: error });
    }
    if (message.includes("email rate limit exceeded") || message.includes("too many emails")) {
      return new AuthError("email_rate_limit", { cause: error });
    }
    if (message.includes("password should be at least")) {
      return new AuthError("weak_password", { field: "password", cause: error });
    }
    if (message.includes("email not confirmed")) {
      return new AuthError("email_not_confirmed", { cause: error });
    }
    if (error.status === 0 || error.status === undefined || NETWORK_PATTERN.test(message)) {
      return new AuthError("network", { cause: error });
    }
    return new AuthError("unknown", { cause: error });
  }

  if (error instanceof Error && NETWORK_PATTERN.test(error.message)) {
    return new AuthError("network", { cause: error });
  }
  return new AuthError("unknown", { cause: error });
}
