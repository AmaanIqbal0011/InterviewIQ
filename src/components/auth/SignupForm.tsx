"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { signUpAction } from "@/app/(auth)/actions";
import { siteConfig } from "@/lib/siteConfig";
import { signupSchema, type SignupValues } from "@/lib/validation/authSchemas";
import { cn } from "@/lib/cn";
import type { AuthActionFieldErrors, AuthActionState } from "@/models/AuthResult";
import type { AuthFieldName } from "@/lib/errors/AuthError";
import type { LegalDocumentKey } from "@/services/LegalContentService";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { TermsModal } from "@/components/auth/TermsModal";
import {
  authInputStyles,
  fieldErrorStyles,
  fieldLabelStyles,
} from "@/components/auth/inputStyles";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface TextFieldProps {
  id: string;
  label: string;
  type: "text" | "email";
  autoComplete: string;
  placeholder: string;
  registration: UseFormRegisterReturn;
  error?: string;
}

function TextField({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  registration,
  error,
}: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className={fieldLabelStyles}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("mt-1.5", authInputStyles(Boolean(error)))}
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className={fieldErrorStyles}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Signup flow: validates live, blocks until every rule and consent passes. */
export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [termsKind, setTermsKind] = useState<LegalDocumentKey>("terms");
  const [termsOpen, setTermsOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, touchedFields, dirtyFields, isSubmitted, isSubmitting, isValid },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const fieldError = (field: AuthFieldName): string | undefined => {
    if (!touchedFields[field] && !dirtyFields[field] && !isSubmitted) {
      return undefined;
    }
    return errors[field]?.message;
  };

  const fullNameError = fieldError("fullName");
  const emailError = fieldError("email");
  const passwordError = fieldError("password");
  const confirmPasswordError = fieldError("confirmPassword");
  const acceptedTermsError = fieldError("acceptedTerms");
  const password = useWatch({ control, name: "password" }) ?? "";

  const openTerms = useCallback((kind: LegalDocumentKey) => {
    setTermsKind(kind);
    setTermsOpen(true);
  }, []);

  const closeTerms = useCallback(() => setTermsOpen(false), []);

  const agreeToTerms = useCallback(() => {
    setTermsOpen(false);
    setValue("acceptedTerms", true, { shouldDirty: true, shouldValidate: true });
  }, [setValue]);

  const applyServerFieldErrors = useCallback(
    (fieldErrors: AuthActionFieldErrors) => {
      (Object.keys(fieldErrors) as AuthFieldName[]).forEach((field) => {
        const message = fieldErrors[field];
        if (message) {
          setError(field, { type: "server", message });
        }
      });
    },
    [setError],
  );

  const onSubmit = useCallback(
    async (values: SignupValues) => {
      setFormError(null);
      const state: AuthActionState = await signUpAction(values);

      if (state.ok) {
        if (state.status === "confirmationRequired") {
          setConfirmationEmail(values.email);
          toast.success("Check your inbox — we sent you a confirmation link.");
        } else {
          toast.success("Account created. Welcome aboard!");
          router.push(siteConfig.routes.onboarding);
        }
        return;
      }

      applyServerFieldErrors(state.fieldErrors);
      setFormError(state.message);
      toast.error(state.message);
    },
    [applyServerFieldErrors, router],
  );

  if (confirmationEmail) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{confirmationEmail}</span>.
          </>
        }
        footer={
          <>
            Already confirmed?{" "}
            <Link
              href={siteConfig.routes.login}
              className="font-medium text-accent transition-colors hover:text-foreground"
            >
              Log in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_16px_36px_-18px_var(--glow)]"
          >
            <Mail className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Click the link in that message to activate your account, then come back and log in.
            If it has not arrived in a few minutes, check your spam folder.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button href={siteConfig.routes.login} className="w-full sm:w-auto">
              Log in
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmationEmail(null)}
              className="w-full sm:w-auto"
            >
              Use a different email
            </Button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <>
      <AuthCard
        title="Create your account"
        subtitle="Start with a free interview — no credit card required."
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={siteConfig.routes.login}
              className="font-medium text-accent transition-colors hover:text-foreground"
            >
              Log in
            </Link>
          </>
        }
      >
        <form
          noValidate
          aria-busy={isSubmitting}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <TextField
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            placeholder="Alex Johnson"
            registration={register("fullName")}
            error={fullNameError}
          />

          <TextField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            registration={register("email")}
            error={emailError}
          />

          <PasswordInput
            id="password"
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            registration={register("password")}
            error={passwordError}
            describedBy="password-strength"
          >
            <PasswordStrength id="password-strength" value={password} className="mt-2.5" />
          </PasswordInput>

          <PasswordInput
            id="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            registration={register("confirmPassword")}
            error={confirmPasswordError}
          />

          <div>
            <div className="flex items-start gap-3">
              <Controller
                control={control}
                name="acceptedTerms"
                render={({ field }) => (
                  <input
                    id="acceptedTerms"
                    type="checkbox"
                    checked={field.value === true}
                    onChange={(event) => field.onChange(event.target.checked)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    aria-invalid={acceptedTermsError ? true : undefined}
                    aria-describedby={acceptedTermsError ? "acceptedTerms-error" : undefined}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-accent"
                  />
                )}
              />
              <label
                htmlFor="acceptedTerms"
                className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
              >
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    openTerms("terms");
                  }}
                  aria-haspopup="dialog"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  Terms &amp; Conditions
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    openTerms("privacy");
                  }}
                  aria-haspopup="dialog"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </button>
              </label>
            </div>
            {acceptedTermsError ? (
              <p id="acceptedTerms-error" role="alert" className={fieldErrorStyles}>
                {acceptedTermsError}
              </p>
            ) : null}
          </div>

          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            >
              {formError}
            </div>
          ) : null}

          <Button type="submit" disabled={!isValid || isSubmitting} className="w-full">
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </AuthCard>

      <TermsModal
        open={termsOpen}
        kind={termsKind}
        onClose={closeTerms}
        onAgree={agreeToTerms}
      />
    </>
  );
}
