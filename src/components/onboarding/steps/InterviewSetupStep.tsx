"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { SelectField, TextAreaField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

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
const languageOptions = [
  { value: "English", label: "English" },
  { value: "Urdu", label: "Urdu" },
  { value: "Hinglish", label: "Hinglish" },
  { value: "Other", label: "Other" },
];
const proficiencyOptions = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
];
const practiceGoals = [
  { value: "confidence", label: "Confidence" },
  { value: "communication", label: "Communication" },
  { value: "technical_answers", label: "Technical answers" },
  { value: "behavioral_answers", label: "Behavioral answers" },
  { value: "english_fluency", label: "English fluency" },
  { value: "time_management", label: "Time management" },
] as const;

export function InterviewSetupStep() {
  const form = useFormContext<OnboardingDraft>();
  const selectedGoals = useWatch({ control: form.control, name: "career_goal.practice_goals" }) ?? [];
  const goalError = form.getFieldState("career_goal.practice_goals").error?.message;

  function toggleGoal(value: (typeof practiceGoals)[number]["value"]) {
    const exists = selectedGoals.includes(value);
    if (!exists && selectedGoals.length >= 3) return;
    form.setValue(
      "career_goal.practice_goals",
      exists ? selectedGoals.filter((goal) => goal !== value) : [...selectedGoals, value],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="career_goal.interview_type" label="Interview focus" options={interviewOptions} />
        <SelectField name="career_goal.difficulty" label="Practice difficulty" options={difficultyOptions} />
        <SelectField name="career_goal.interview_language" label="Interview language" options={languageOptions} />
        <SelectField name="interview_language_proficiency" label="Language proficiency" options={proficiencyOptions} />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-foreground">Practice goals</legend>
        <p className="mt-1 text-xs text-muted-foreground">Choose 1–3.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {practiceGoals.map((goal) => (
            <label key={goal.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-strong px-3.5 text-sm">
              <input
                type="checkbox"
                checked={selectedGoals.includes(goal.value)}
                onChange={() => toggleGoal(goal.value)}
                className="h-4 w-4 accent-accent"
              />
              {goal.label}
            </label>
          ))}
        </div>
        {goalError && <p role="alert" className="mt-1.5 text-xs text-red-500">{goalError}</p>}
      </fieldset>
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
