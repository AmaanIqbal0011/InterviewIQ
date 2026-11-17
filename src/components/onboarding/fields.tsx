"use client";

import { useState, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { cn } from "@/lib/cn";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const fieldClass =
  "mt-2 h-12 w-full rounded-xl border border-border bg-surface-strong px-3.5 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20";

export function Field({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
}: {
  name: FieldPath<OnboardingDraft>;
  label: string;
  type?: "text" | "email";
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  const form = useFormContext<OnboardingDraft>();
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error && "border-red-500/70 focus:border-red-500")}
        {...form.register(name)}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
}: {
  name: FieldPath<OnboardingDraft>;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const form = useFormContext<OnboardingDraft>();
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error && "border-red-500/70 focus:border-red-500")}
        {...form.register(name)}
      >
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  placeholder,
  maxLength,
  rows = 4,
}: {
  name: FieldPath<OnboardingDraft>;
  label: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  const form = useFormContext<OnboardingDraft>();
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "mt-2 w-full resize-y rounded-xl border border-border bg-surface-strong px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
          error && "border-red-500/70 focus:border-red-500",
        )}
        {...form.register(name)}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function YearPicker({
  name,
  label,
  nullable = false,
  maxYear = new Date().getFullYear() + 1,
}: {
  name: FieldPath<OnboardingDraft>;
  label: string;
  nullable?: boolean;
  maxYear?: number;
}) {
  const form = useFormContext<OnboardingDraft>();
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        type="number"
        min={1900}
        max={maxYear}
        placeholder="YYYY"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error && "border-red-500/70 focus:border-red-500")}
        {...form.register(name, {
          setValueAs: (value: string) => value === "" ? (nullable ? null : Number.NaN) : Number(value),
        })}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function DateField({
  name,
  label,
  nullable = false,
}: {
  name: FieldPath<OnboardingDraft>;
  label: string;
  nullable?: boolean;
}) {
  const form = useFormContext<OnboardingDraft>();
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        type="date"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error && "border-red-500/70 focus:border-red-500")}
        {...form.register(name, {
          setValueAs: (value: string) => value === "" ? (nullable ? null : "") : value,
        })}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function RepeatableList({
  title,
  description,
  count,
  addLabel,
  max,
  onAdd,
  onRemove,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  addLabel: string;
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (index: number) => ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{count} / {max}</span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border bg-surface-strong/70 p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Entry {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove entry ${index + 1}`}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Remove
              </button>
            </div>
            {children(index)}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={count >= max}
        className="inline-flex min-h-10 items-center rounded-full border border-dashed border-accent/40 px-4 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        + {addLabel}
      </button>
    </div>
  );
}

export function ChipInput({
  name,
  label,
  placeholder,
}: {
  name: "career_goal.target_companies";
  label: string;
  placeholder: string;
}) {
  const form = useFormContext<OnboardingDraft>();
  const values = form.watch(name);
  const [draft, setDraft] = useState("");
  const id = name.replaceAll(".", "-");
  const error = form.getFieldState(name).error?.message;

  function addValue(value: string) {
    const clean = value.trim().slice(0, 80);
    if (!clean || values.length >= 10 || values.some((entry) => entry.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    form.setValue(name, [...values, clean], { shouldDirty: true, shouldValidate: true });
    setDraft("");
  }

  return (
    <div>
      <label htmlFor={`${id}-input`} className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-strong px-3 py-2 focus-within:ring-2 focus-within:ring-accent/20">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-foreground">
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => form.setValue(name, values.filter((_, itemIndex) => itemIndex !== index), { shouldDirty: true })}
              className="rounded-full px-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          value={draft}
          maxLength={80}
          placeholder={values.length < 10 ? placeholder : "Company limit reached"}
          disabled={values.length >= 10}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addValue(draft);
            }
          }}
          onBlur={() => addValue(draft)}
          className="min-w-32 flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Press Enter or comma after each company.</p>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ReviewSection({
  title,
  items,
  step,
  onEdit,
}: {
  title: string;
  items: ReadonlyArray<string>;
  step: number;
  onEdit: (step: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-strong/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Edit
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
        {items.length > 0
          ? items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
          : <li>Not added</li>}
      </ul>
    </section>
  );
}
