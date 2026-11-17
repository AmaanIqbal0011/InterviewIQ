import type { AuthError, AuthFieldName } from "@/lib/errors/AuthError";
import type { User } from "@/models/User";

/** Where an auth call left the user. */
export type AuthStatus = "signedIn" | "signedOut" | "confirmationRequired";

export interface AuthSuccess {
  readonly ok: true;
  readonly status: AuthStatus;
  readonly user: User | null;
}

export interface AuthFailure {
  readonly ok: false;
  readonly error: AuthError;
}

/** Result of any `AuthService` call. */
export type AuthResult = AuthSuccess | AuthFailure;

/** Per-field messages a server action hands back to the form. */
export type AuthActionFieldErrors = Partial<Record<AuthFieldName, string>>;

export interface AuthActionSuccess {
  readonly ok: true;
  readonly status: AuthStatus;
}

export interface AuthActionFailure {
  readonly ok: false;
  /** Friendly message safe to toast. */
  readonly message: string;
  /** Empty when the failure does not belong to a single field. */
  readonly fieldErrors: AuthActionFieldErrors;
}

/**
 * Serializable payload a server action returns. Class instances lose their
 * prototype over the action boundary, so this is deliberately plain data.
 */
export type AuthActionState = AuthActionSuccess | AuthActionFailure;
