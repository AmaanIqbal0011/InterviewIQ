"use server";

import { z } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { AuthError, mapSupabaseError } from "@/lib/errors/AuthError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  aboutYouSchema,
  careerTargetStepSchema,
  educationStepSchema,
  interviewSetupStepSchema,
} from "@/lib/validation/onboardingSchemas";
import { OnboardingService } from "@/services/OnboardingService";

export type OnboardingActionResult =
  | { ok: true; step: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function invalidResult(error: z.ZodError): OnboardingActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, message: "Please review your answers and try again.", fieldErrors };
}

function errorResult(error: unknown): OnboardingActionResult {
  if (error instanceof AppError || error instanceof AuthError) {
    console.error("Onboarding action failed", { code: error.code, message: error.message });
    return { ok: false, message: error.message };
  }
  console.error("Onboarding action failed", {
    code: "unexpected",
    message: "Unexpected onboarding failure",
  });
  return { ok: false, message: "We couldn't save your changes. Please try again." };
}

export async function saveStepAction(
  stepNumber: number,
  rawData: unknown,
): Promise<OnboardingActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const authError = error ? mapSupabaseError(error) : new AuthError("unknown");
      return { ok: false, message: authError.message };
    }

    const service = new OnboardingService(supabase);
    switch (stepNumber) {
      case 1: {
        const parsed = aboutYouSchema.safeParse(rawData);
        if (!parsed.success) return invalidResult(parsed.error);
        await service.saveStep(user.id, 1, parsed.data);
        break;
      }
      case 2: {
        const parsed = educationStepSchema.safeParse(rawData);
        if (!parsed.success) return invalidResult(parsed.error);
        await service.saveStep(user.id, 2, parsed.data);
        break;
      }
      case 3: {
        const parsed = careerTargetStepSchema.safeParse(rawData);
        if (!parsed.success) return invalidResult(parsed.error);
        await service.saveStep(user.id, 3, parsed.data);
        break;
      }
      case 4: {
        const parsed = interviewSetupStepSchema.safeParse(rawData);
        if (!parsed.success) return invalidResult(parsed.error);
        await service.saveStep(user.id, 4, parsed.data);
        break;
      }
      default:
        return { ok: false, message: "That onboarding step is unavailable." };
    }
    return { ok: true, step: stepNumber + 1 };
  } catch (error) {
    return errorResult(error);
  }
}

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const authError = error ? mapSupabaseError(error) : new AuthError("unknown");
      return { ok: false, message: authError.message };
    }
    await new OnboardingService(supabase).completeOnboarding(user.id);
    return { ok: true, step: 4 };
  } catch (error) {
    return errorResult(error);
  }
}
