"use client";

import { useFormContext } from "react-hook-form";
import { Field, SelectField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const levelOptions = [
  { value: "high_school", label: "High school" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
  { value: "other", label: "Other" },
];

export function EducationStep() {
  const form = useFormContext<OnboardingDraft>();
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="education.0.level" label="Education level" options={levelOptions} />
        <Field name="education.0.institution" label="Institution" placeholder="School or university" maxLength={160} />
        <div className="sm:col-span-2">
          <Field name="education.0.field_of_study" label="Field of study (optional)" placeholder="e.g. Computer science" maxLength={120} />
        </div>
      </div>
      <label className="inline-flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-accent"
          {...form.register("education.0.is_current")}
        />
        I&apos;m currently studying here
      </label>
      {form.getFieldState("education").error?.message && (
        <p role="alert" className="text-sm text-red-500">
          {form.getFieldState("education").error?.message}
        </p>
      )}
    </div>
  );
}
