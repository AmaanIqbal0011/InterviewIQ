"use client";

import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const categoryOptions = [
  { value: "technical", label: "Technical" },
  { value: "soft", label: "People skill" },
  { value: "tool", label: "Tool" },
] as const;
const levelOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export function SkillsStep() {
  const form = useFormContext<OnboardingDraft>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "skills",
    keyName: "fieldKey",
  });
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]["value"]>("technical");
  const [level, setLevel] = useState<(typeof levelOptions)[number]["value"]>("intermediate");
  const [draftError, setDraftError] = useState("");
  const error = form.getFieldState("skills").error?.message;

  function addSkill() {
    const cleanName = name.trim();
    if (!cleanName) {
      setDraftError("Enter a skill before adding it.");
      return;
    }
    if (fields.some((skill) => skill.name.toLowerCase() === cleanName.toLowerCase())) {
      setDraftError("That skill is already on your list.");
      return;
    }
    if (fields.length >= 30) {
      setDraftError("You can add up to 30 skills.");
      return;
    }
    append({ name: cleanName.slice(0, 50), category, level });
    setName("");
    setDraftError("");
    form.clearErrors("skills");
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Add at least three skills. We&apos;ll use these to shape realistic interview questions.
      </p>
      <div className="grid gap-3 rounded-2xl border border-border bg-surface-strong/60 p-4 sm:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="skill-name" className="block text-sm font-medium text-foreground">Skill</label>
          <input
            id="skill-name"
            value={name}
            maxLength={50}
            placeholder="e.g. React or stakeholder management"
            aria-invalid={Boolean(draftError)}
            aria-describedby={draftError ? "skill-name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setDraftError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSkill();
              }
            }}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
          {draftError && <p id="skill-name-error" className="mt-1.5 text-xs text-red-500">{draftError}</p>}
        </div>
        <label className="block text-sm font-medium text-foreground">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          >
            {categoryOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Level
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as typeof level)}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          >
            {levelOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addSkill}
          disabled={fields.length >= 30}
          className="h-12 rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 px-5 text-sm font-semibold text-white shadow-[0_12px_32px_-14px_var(--glow)] transition hover:brightness-110 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Add skill
        </button>
      </div>

      <div aria-live="polite" className="flex min-h-12 flex-wrap gap-2">
        {fields.map((skill, index) => (
          <span
            key={skill.fieldKey}
            className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 py-1.5 pl-3.5 pr-2 text-sm text-foreground"
          >
            <span className="font-medium">{skill.name}</span>
            <span className="text-xs text-muted-foreground">
              {skill.category.replaceAll("_", " ")} · {skill.level}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove ${skill.name}`}
              className="rounded-full px-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              ×
            </button>
          </span>
        ))}
        {fields.length === 0 && (
          <span className="self-center text-sm text-muted-foreground">Your skills will appear here as chips.</span>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
