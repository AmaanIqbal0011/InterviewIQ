"use server";

import { AppError } from "@/lib/errors/AppError";
import { AuthError } from "@/lib/errors/AuthError";
import { ResumeError } from "@/lib/errors/ResumeError";
import {
  registerResumeInputSchema,
  type RegisterResumeInput,
} from "@/lib/validation/resumeSchemas";
import { AuthGuard } from "@/guards/AuthGuard";
import type { ResumeInfo } from "@/models/ResumeInfo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumeService } from "@/services/resume/createResumeService";

export type RegisterResumeActionResult =
  | { readonly ok: true; readonly resume: ResumeInfo }
  | { readonly ok: false; readonly message: string };

function failure(error: unknown): RegisterResumeActionResult {
  if (error instanceof ResumeError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof AppError || error instanceof AuthError) {
    return { ok: false, message: error.message };
  }

  console.error("Resume registration failed", {
    reason: error instanceof Error ? error.name : "unknown",
  });
  return { ok: false, message: "We couldn't save that upload. Please try again." };
}

/**
 * Saves metadata for a file the browser already placed in the user's storage
 * folder. Everything meaningful (ownership, size, MIME type) is re-verified
 * on the server; the client-supplied values are only hints.
 */
export async function registerResumeAction(
  rawValues: RegisterResumeInput,
): Promise<RegisterResumeActionResult> {
  const parsed = registerResumeInputSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { ok: false, message: "That upload didn't look right. Please choose the file again." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const user = await new AuthGuard(supabase).getCurrentUser();
    if (!user) {
      return { ok: false, message: "Your session expired. Please sign in again." };
    }

    const resume = await createResumeService(supabase).registerUpload(
      user.id,
      parsed.data,
    );

    return { ok: true, resume };
  } catch (error) {
    return failure(error);
  }
}
