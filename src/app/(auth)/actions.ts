"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthError, type AuthFieldName } from "@/lib/errors/AuthError";
import { loginSchema, signupSchema } from "@/lib/validation/authSchemas";
import { AuthService } from "@/services/AuthService";
import { SignInPayload } from "@/models/SignInPayload";
import { SignUpPayload } from "@/models/SignUpPayload";
import type {
  AuthActionFieldErrors,
  AuthActionState,
  AuthResult,
} from "@/models/AuthResult";

function authFailure(error: AuthError): AuthActionState {
  const fieldErrors: AuthActionFieldErrors = {};
  if (error.field) {
    fieldErrors[error.field] = error.message;
  }
  return { ok: false, message: error.message, fieldErrors };
}

function validationFailure(error: z.ZodError): AuthActionState {
  const fieldErrors: AuthActionFieldErrors = {};

  for (const issue of error.issues) {
    const [field] = issue.path;
    if (typeof field !== "string" || !issue.message) {
      continue;
    }
    const key = field as AuthFieldName;
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return {
    ok: false,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors,
  };
}

function toActionState(result: AuthResult): AuthActionState {
  return result.ok ? { ok: true, status: result.status } : authFailure(result.error);
}

/** Explicit server-side consent gate — independent of the schema. */
function hasAcceptedTerms(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (value as { acceptedTerms?: unknown }).acceptedTerms === true;
}

export async function signUpAction(rawValues: unknown): Promise<AuthActionState> {
  if (!hasAcceptedTerms(rawValues)) {
    return authFailure(new AuthError("terms_not_accepted", { field: "acceptedTerms" }));
  }

  const parsed = signupSchema.safeParse(rawValues);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const authService = new AuthService(await createSupabaseServerClient());
  const result = await authService.signUp(
    new SignUpPayload({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      acceptedTerms: parsed.data.acceptedTerms,
    }),
  );

  return toActionState(result);
}

export async function signInAction(rawValues: unknown): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(rawValues);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const authService = new AuthService(await createSupabaseServerClient());
  const result = await authService.signIn(new SignInPayload(parsed.data));

  return toActionState(result);
}
