import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { resolveDisplayName } from "@/lib/displayName";
import { isSessionMissingError, mapSupabaseError, AuthError } from "@/lib/errors/AuthError";
import { TERMS_VERSION } from "@/lib/siteConfig";
import type { AuthResult, AuthStatus } from "@/models/AuthResult";
import type { SignInPayload } from "@/models/SignInPayload";
import type { SignUpPayload } from "@/models/SignUpPayload";
import { User } from "@/models/User";

function failure(error: AuthError): AuthResult {
  return { ok: false, error };
}

function logSupabaseAuthError(operation: "sign-up" | "sign-in", error: unknown): void {
  if (typeof window !== "undefined" || typeof error !== "object" || error === null) {
    return;
  }

  console.error(`Supabase auth ${operation} failed`, {
    message: "message" in error ? error.message : undefined,
    status: "status" in error ? error.status : undefined,
    code: "code" in error ? error.code : undefined,
  });
}

/**
 * The only module in the project that talks to Supabase Auth.
 *
 * Every entry point returns an {@link AuthResult} instead of throwing, and any
 * provider failure is translated into a friendly, display-safe {@link AuthError}.
 * The Supabase client is injected so the same service works on the server
 * (cookie-backed client) and in the browser (document-cookie client).
 */
export class AuthService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Creates an account. Refuses outright when consent is missing, and stamps
   * the accepted terms version onto the user's metadata.
   *
   * Returns `confirmationRequired` when the project asks the user to confirm
   * their email, otherwise `signedIn` with a fresh session.
   */
  async signUp(payload: SignUpPayload): Promise<AuthResult> {
    if (!payload.acceptedTerms) {
      return failure(new AuthError("terms_not_accepted", { field: "acceptedTerms" }));
    }

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName,
            acceptedTerms: true,
            acceptedTermsAt: new Date().toISOString(),
            termsVersion: TERMS_VERSION,
          },
        },
      });

      if (error) {
        logSupabaseAuthError("sign-up", error);
        return failure(mapSupabaseError(error));
      }

      const user = data.user;
      if (!user) {
        return failure(new AuthError("unknown"));
      }

      // Supabase answers with an identity-less user when the address is taken.
      if (user.identities && user.identities.length === 0) {
        return failure(new AuthError("email_taken", { field: "email" }));
      }

      const status: AuthStatus = data.session ? "signedIn" : "confirmationRequired";
      return { ok: true, status, user: this.toUser(user) };
    } catch (error) {
      logSupabaseAuthError("sign-up", error);
      return failure(mapSupabaseError(error));
    }
  }

  /** Signs in with email and password, establishing a session cookie. */
  async signIn(payload: SignInPayload): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (error) {
        logSupabaseAuthError("sign-in", error);
        return failure(mapSupabaseError(error));
      }
      if (!data.session || !data.user) {
        return failure(new AuthError("invalid_credentials"));
      }

      return { ok: true, status: "signedIn", user: this.toUser(data.user) };
    } catch (error) {
      logSupabaseAuthError("sign-in", error);
      return failure(mapSupabaseError(error));
    }
  }

  /** Clears the local session. A failure here is surfaced, never swallowed. */
  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        return failure(mapSupabaseError(error));
      }
      return { ok: true, status: "signedOut", user: null };
    } catch (error) {
      return failure(mapSupabaseError(error));
    }
  }

  /** Resolves the current user, refreshing the session when possible. */
  async getCurrentUser(): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.getUser();

      if (data.user) {
        return { ok: true, status: "signedIn", user: this.toUser(data.user) };
      }
      // No session is a normal signed-out state, not an error.
      if (error && !isSessionMissingError(error)) {
        return failure(mapSupabaseError(error));
      }
      return { ok: true, status: "signedOut", user: null };
    } catch (error) {
      return failure(mapSupabaseError(error));
    }
  }

  private toUser(supabaseUser: SupabaseUser): User {
    return new User({
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      // full_name → name → email local part, resolved once at the boundary.
      fullName: resolveDisplayName(supabaseUser.user_metadata, supabaseUser.email),
    });
  }
}
