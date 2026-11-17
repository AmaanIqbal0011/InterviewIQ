import { connection } from "next/server";
import { AuthGuard } from "@/guards/AuthGuard";
import { jsonError, jsonOk, resumeErrorResponse } from "@/lib/resume/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumeService } from "@/services/resume/createResumeService";

/**
 * GET /api/resume/status
 * Returns the same card DTO the dashboard renders. Used for polling while a
 * parse is in flight.
 */
export async function GET(): Promise<Response> {
  // Stops build-time prerendering before the cookie read, so `cacheComponents`
  // defers this route to request time instead of failing inside the try block.
  await connection();

  try {
    const supabase = await createSupabaseServerClient();
    const user = await new AuthGuard(supabase).getCurrentUser();
    if (!user) {
      return jsonError("Please sign in again.", 401);
    }

    const resume = await createResumeService(supabase).getState(user.id);
    return jsonOk(resume);
  } catch (error) {
    return resumeErrorResponse(error);
  }
}
