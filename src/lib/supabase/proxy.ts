import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_PATHS,
  PROTECTED_PATHS,
  destinationFor,
  matchesPath,
} from "@/guards/AuthGuard";
import { ProfileRepository } from "@/repositories/ProfileRepository";
import { AppError } from "@/lib/errors/AppError";
import type { Profile } from "@/models/Profile";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Supabase session check failed", { code: error.code, message: error.message });
  }

  // Optimistic checks only — the layouts under (protected) re-run the
  // authoritative AuthGuard before rendering anything sensitive.
  const { pathname } = request.nextUrl;
  if (!user && matchesPath(pathname, PROTECTED_PATHS)) {
    return redirectTo(request, response, "/login");
  }
  if (user && matchesPath(pathname, [...PROTECTED_PATHS, ...AUTH_PATHS])) {
    const profile = await loadProfile(supabase, user.id);
    if (profile) {
      const destination = destinationFor(profile);
      if (
        matchesPath(pathname, AUTH_PATHS) ||
        (!profile.onboardingCompleted && !matchesPath(pathname, ["/onboarding"])) ||
        (profile.onboardingCompleted && matchesPath(pathname, ["/onboarding"]))
      ) {
        return redirectTo(request, response, destination);
      }
    }
  }

  return response;
}

/**
 * A profile read must never take the whole request down: a failure here used
 * to throw from the proxy, which broke every route (including /login). Log it
 * and let the destination page's own guards handle the visitor instead.
 */
async function loadProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile | null> {
  try {
    return await new ProfileRepository(supabase).getByUserId(userId);
  } catch (error) {
    console.error("Session profile lookup failed", {
      code: error instanceof AppError ? error.code : "unexpected",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function redirectTo(request: NextRequest, sessionResponse: NextResponse, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
  return redirect;
}
