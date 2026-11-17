"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { signInAction } from "@/app/(auth)/actions";
import { siteConfig } from "@/lib/siteConfig";
import { loginSchema, type LoginValues } from "@/lib/validation/authSchemas";
import { cn } from "@/lib/cn";
import type { AuthActionFieldErrors, AuthActionState } from "@/models/AuthResult";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  authInputStyles,
  fieldErrorStyles,
  fieldLabelStyles,
} from "@/components/auth/inputStyles";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

/** Login flow: friendly error mapping, then straight to the dashboard. */
export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, touchedFields, dirtyFields, isSubmitted, isSubmitting, isValid },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const fieldError = (field: "email" | "password"): string | undefined => {
    if (!touchedFields[field] && !dirtyFields[field] && !isSubmitted) {
      return undefined;
    }
    return errors[field]?.message;
  };

  const emailError = fieldError("email");
  const passwordError = fieldError("password");

  const applyServerFieldErrors = useCallback(
    (fieldErrors: AuthActionFieldErrors) => {
      (Object.keys(fieldErrors) as Array<keyof LoginValues>).forEach((field) => {
        const message = fieldErrors[field];
        if (message) {
          setError(field, { type: "server", message });
        }
      });
    },
    [setError],
  );

  const onSubmit = useCallback(
    async (values: LoginValues) => {
      setFormError(null);
      const state: AuthActionState = await signInAction(values);

      if (state.ok) {
        toast.success("Welcome back!");
        router.push(siteConfig.routes.dashboard);
        return;
      }

      applyServerFieldErrors(state.fieldErrors);
      setFormError(state.message);
      toast.error(state.message);
    },
    [applyServerFieldErrors, router],
  );

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to pick up your interviews and reports where you left off."
      footer={
        <>
          New to {siteConfig.brand.name}?{" "}
          <Link
            href={siteConfig.routes.signup}
            className="font-medium text-accent transition-colors hover:text-foreground"
          >
            Create an account
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
        <div>
          <label htmlFor="email" className={fieldLabelStyles}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            className={cn("mt-1.5", authInputStyles(Boolean(emailError)))}
            {...register("email")}
          />
          {emailError ? (
            <p id="email-error" role="alert" className={fieldErrorStyles}>
              {emailError}
            </p>
          ) : null}
        </div>

        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          registration={register("password")}
          error={passwordError}
          labelExtra={
            <Link
              href={siteConfig.routes.forgotPassword}
              className="text-xs font-medium text-accent transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          }
        />

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
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
