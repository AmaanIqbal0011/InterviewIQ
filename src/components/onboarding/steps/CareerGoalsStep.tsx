"use client";

import { ChipInput, Field, SelectField, TextAreaField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const experienceOptions = [
  { value: "entry", label: "Entry level" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];
const interviewOptions = [
  { value: "mixed", label: "A mix of everything" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "hr", label: "HR / culture fit" },
];
const difficultyOptions = [
  { value: "easy", label: "Warm-up" },
  { value: "medium", label: "Balanced" },
  { value: "hard", label: "Challenging" },
];

export function CareerGoalsStep({ interviewLanguage }: { interviewLanguage: string }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="career_goal.target_role" label="Target role" placeholder="e.g. Senior product designer" maxLength={120} />
        <Field name="career_goal.target_industry" label="Industry (optional)" placeholder="e.g. Climate technology" maxLength={120} />
        <SelectField name="career_goal.experience_level" label="Experience level" options={experienceOptions} />
        <SelectField name="career_goal.interview_type" label="Interview focus" options={interviewOptions} />
        <SelectField name="career_goal.difficulty" label="Practice difficulty" options={difficultyOptions} />
        <label className="block text-sm font-medium text-foreground">
          AI interviewer language
          <input
            value={interviewLanguage || "Choose a language in the previous step"}
            readOnly
            aria-readonly="true"
            className="mt-2 h-12 w-full rounded-xl border border-border bg-surface-strong px-3.5 text-sm text-foreground"
          />
        </label>
      </div>
      <ChipInput
        name="career_goal.target_companies"
        label="Companies you have in mind (optional)"
        placeholder="Type a company and press Enter"
      />
      <TextAreaField
        name="career_goal.additional_notes"
        label="Anything else we should keep in mind? (optional)"
        placeholder="Share focus areas or interview situations you want to practice."
        maxLength={500}
        rows={4}
      />
    </div>
  );
}

export type CareerGoalDraft = OnboardingDraft["career_goal"];
