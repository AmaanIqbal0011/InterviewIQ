"use client";

import { Field, SelectField } from "@/components/onboarding/fields";

const statusOptions = [
  { value: "student", label: "Student" },
  { value: "working_professional", label: "Working professional" },
  { value: "fresher", label: "Recent graduate" },
  { value: "career_switcher", label: "Changing careers" },
  { value: "other", label: "Other" },
];

export function AboutYouStep() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field name="full_name" label="Full name" autoComplete="name" placeholder="How should we address you?" maxLength={80} />
      </div>
      <div className="sm:col-span-2">
        <SelectField name="current_status" label="Which best describes you?" options={statusOptions} />
      </div>
    </div>
  );
}
