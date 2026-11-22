"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChipInput, Field, SelectField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const experienceOptions = [
  { value: "entry", label: "Entry level" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

export function CareerTargetStep() {
  const form = useFormContext<OnboardingDraft>();
  const topSkills = useWatch({ control: form.control, name: "top_skills" }) ?? [];
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");

  function addSkill() {
    const clean = draft.trim().slice(0, 50);
    if (!clean) return;
    if (topSkills.length >= 10) {
      setDraftError("You can add up to 10 top skills.");
      return;
    }
    if (topSkills.some((skill) => skill.toLowerCase() === clean.toLowerCase())) {
      setDraftError("That skill is already in your list.");
      return;
    }
    form.setValue("top_skills", [...topSkills, clean], { shouldDirty: true, shouldValidate: true });
    setDraft("");
    setDraftError("");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="career_goal.target_role" label="Target role" placeholder="e.g. Senior product designer" maxLength={120} />
        <Field name="career_goal.target_industry" label="Industry (optional)" placeholder="e.g. Climate technology" maxLength={120} />
        <div className="sm:col-span-2">
          <SelectField name="career_goal.experience_level" label="Experience level" options={experienceOptions} />
        </div>
      </div>
      <ChipInput
        name="career_goal.target_companies"
        label="Companies you have in mind (optional)"
        placeholder="Type a company and press Enter"
      />
      <div>
        <label htmlFor="top-skill-input" className="block text-sm font-medium text-foreground">Top skills (optional)</label>
        <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-strong px-3 py-2">
          {topSkills.map((skill, index) => (
            <span key={`${skill}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-foreground">
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() => form.setValue("top_skills", topSkills.filter((_, itemIndex) => itemIndex !== index), { shouldDirty: true })}
                className="rounded-full px-1 text-muted-foreground"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="top-skill-input"
            value={draft}
            maxLength={50}
            disabled={topSkills.length >= 10}
            placeholder={topSkills.length < 10 ? "Type a skill and press Enter" : "Skill limit reached"}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addSkill();
              }
            }}
            onBlur={addSkill}
            className="min-w-32 flex-1 bg-transparent py-1 text-sm text-foreground outline-none"
          />
        </div>
        {draftError && <p role="alert" className="mt-1.5 text-xs text-red-500">{draftError}</p>}
      </div>
    </div>
  );
}
