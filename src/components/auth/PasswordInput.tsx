"use client";

import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import {
  authInputStyles,
  fieldErrorStyles,
  fieldLabelStyles,
} from "@/components/auth/inputStyles";

interface PasswordInputProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  error?: string;
  /** Extra ids (e.g. the strength meter) announced alongside the field. */
  describedBy?: string;
  /** Trailing control rendered next to the label (e.g. "Forgot password?"). */
  labelExtra?: ReactNode;
  children?: ReactNode;
}

/** Labelled password field with a show/hide toggle and inline error. */
export function PasswordInput({
  id,
  label,
  registration,
  autoComplete,
  placeholder,
  error,
  describedBy,
  labelExtra,
  children,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const describedIds =
    [describedBy, error ? errorId : null].filter((value): value is string => Boolean(value)).join(" ") ||
    undefined;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={fieldLabelStyles}>
          {label}
        </label>
        {labelExtra}
      </div>

      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedIds}
          className={authInputStyles(Boolean(error), "pl-3.5 pr-12")}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>

      {children}

      {error ? (
        <p id={errorId} role="alert" className={fieldErrorStyles}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
