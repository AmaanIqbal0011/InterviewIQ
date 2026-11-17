import { redirect } from "next/navigation";
import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors/AppError";
import { isSessionMissingError, mapSupabaseError } from "@/lib/errors/AuthError";
import { siteConfig } from "@/lib/siteConfig";
import type { Profile } from "@/models/Profile";
import { User } from "@/models/User";
import type { Database } from "@/types/database";
import { IProfileRepository, ProfileRepository } from "@/repositories/ProfileRepository";

/** Route prefixes that require a signed-in visitor (shared with the proxy). */
export const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/interview", "/resume"] as const;
/** Route prefixes reserved for signed-out visitors (shared with the proxy). */
export const AUTH_PATHS = ["/login", "/signup"] as const;

/** True when the pathname equals a prefix or lives underneath it. */
export function matchesPath(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Where a signed-in visitor belongs given their onboarding state. */
export function destinationFor(profile: Profile): string {
  return profile.onboardingCompleted
    ? siteConfig.routes.dashboard
    : siteConfig.routes.onboarding;
}

/**
 * The single source of truth for route access rules on the server.
 *
 * Layouts and pages call the `require*` methods, which redirect (via
 * `next/navigation`) when the visitor is not allowed through. The proxy
 * reuses the path lists and destination rule above so optimistic checks
 * never drift from the authoritative server-side checks.
 */
export class AuthGuard {
  private readonly supabase: SupabaseClient<Database>;
  private readonly profiles: IProfileRepository;

  constructor(supabase: SupabaseClient<Database>, profiles?: IProfileRepository) {
    this.supabase = supabase;
    this.profiles = profiles ?? new ProfileRepository(supabase);
  }

  /** Resolves the signed-in user, or null when there is no usable session. */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error) {
      // No session is a normal signed-out state, not a failure.
      if (isSessionMissingError(error)) return null;
      throw mapSupabaseError(error);
    }
    if (!user) return null;
    return this.toUser(user);
  }

  /** Signed-in user or a redirect to /login. Never returns null. */
  async requireUser(): Promise<User> {
    const user = await this.getCurrentUser();
    if (!user) redirect(siteConfig.routes.login);
    return user;
  }

  /**
   * Signed-in user whose onboarding is finished, plus their profile.
   * Anyone else is redirected to /onboarding (or /login when signed out).
   */
  async requireOnboardingComplete(): Promise<{ user: User; profile: Profile }> {
    const user = await this.requireUser();
    const profile = await this.loadProfile(user.id);
    if (!profile || !profile.onboardingCompleted) redirect(siteConfig.routes.onboarding);
    return { user, profile };
  }

  /**
   * Signed-in user who still needs onboarding, for the onboarding route.
   * Finished users are sent to /dashboard so they never see it again.
   */
  async requireOnboardingIncomplete(): Promise<User> {
    const user = await this.requireUser();
    const profile = await this.loadProfile(user.id);
    if (profile?.onboardingCompleted) redirect(siteConfig.routes.dashboard);
    return user;
  }

  /** Profile row for the user, or null when onboarding never started. */
  private async loadProfile(userId: string): Promise<Profile | null> {
    try {
      return await this.profiles.getByUserId(userId);
    } catch (error) {
      // A missing profile row simply means "not onboarded yet"; real
      // failures (network, database) surface to the error boundary.
      if (error instanceof AppError && error.code === "not_found") return null;
      throw error;
    }
  }

  private toUser(supabaseUser: SupabaseUser): User {
    const rawName: unknown = supabaseUser.user_metadata.full_name;
    return new User({
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      fullName: typeof rawName === "string" ? rawName : "",
    });
  }
}
