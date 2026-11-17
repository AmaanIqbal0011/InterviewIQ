import { AuthGuard } from "@/guards/AuthGuard";
import { jsonError, jsonOk, resumeErrorResponse } from "@/lib/resume/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseResumeRequestSchema } from "@/lib/validation/resumeSchemas";
import { createResumeService } from "@/services/resume/createResumeService";

/**
 * POST /api/resume/parse
 * Body: { resumeId: string }. Verifies the row belongs to the signed-in user,
 * then downloads, extracts, and parses the file. Re-running is idempotent.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body with a resumeId.", 400);
  }

  const parsed = parseResumeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Send a valid resumeId.", 400);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const user = await new AuthGuard(supabase).getCurrentUser();
    if (!user) {
      return jsonError("Please sign in again.", 401);
    }

    const resume = await createResumeService(supabase).parse(
      user.id,
      parsed.data.resumeId,
    );
    return jsonOk(resume);
  } catch (error) {
    return resumeErrorResponse(error);
  }
}
