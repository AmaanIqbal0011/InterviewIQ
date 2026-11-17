import { z } from "zod";

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** A single strength rule shown live under the password field. */
export interface PasswordRule {
  readonly key: "length" | "uppercase" | "lowercase" | "number";
  readonly label: string;
  readonly test: (value: string) => boolean;
}

/** Drives both the strength meter and the requirement checklist. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    key: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { key: "uppercase", label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { key: "lowercase", label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { key: "number", label: "One number", test: (value) => /\d/.test(value) },
];

const fullNameSchema = z
  .string()
  .trim()
  .min(FULL_NAME_MIN_LENGTH, "Enter your full name.")
  .max(FULL_NAME_MAX_LENGTH, "Keep your name under 80 characters.");

/** Trims first, then validates the format — pasted addresses get cleaned up. */
const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(EMAIL_MAX_LENGTH, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, "That password is too long.");

/**
 * Shared by the signup form (client) and the server action, so both sides
 * enforce exactly the same rules — including the terms checkbox, which is a
 * literal `true`.
 */
export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password."),
    acceptedTerms: z.literal(true, { error: "Accept the Terms & Conditions to continue." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export type SignupValues = z.output<typeof signupSchema>;
export type LoginValues = z.output<typeof loginSchema>;
