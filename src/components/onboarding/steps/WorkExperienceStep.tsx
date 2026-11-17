"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { DateField, Field, RepeatableList, SelectField, TextAreaField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const employmentOptions = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "other", label: "Other" },
];

export function WorkExperienceStep() {
  const form = useFormContext<OnboardingDraft>();
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "work_experiences",
    keyName: "fieldKey",
  });
  const noExperience = form.watch("no_experience");

  return (
    <div className="space-y-6">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-strong/60 px-4 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-accent"
          {...form.register("no_experience", {
            onChange: (event) => {
              if (event.target.checked) replace([]);
            },
          })}
        />
        I have no experience yet
      </label>

      {!noExperience && (
        <RepeatableList
          title="Work experience"
          description="Include internships, part-time work, and volunteer roles."
          count={fields.length}
          max={15}
          addLabel="Add experience"
          onAdd={() => append({
            job_title: "",
            company: "",
            employment_type: "full_time",
            start_date: "",
            end_date: null,
            is_current: false,
            description: "",
          })}
          onRemove={remove}
        >
          {(index) => {
            const currentName = `work_experiences.${index}.is_current` as const;
            const endName = `work_experiences.${index}.end_date` as const;
            const isCurrent = form.watch(currentName);
            return (
              <div className="space-y-4" key={fields[index]?.fieldKey}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name={`work_experiences.${index}.job_title`} label="Job title" placeholder="e.g. Product designer" maxLength={120} />
                  <Field name={`work_experiences.${index}.company`} label="Company" placeholder="Organization name" maxLength={160} />
                  <SelectField name={`work_experiences.${index}.employment_type`} label="Employment type" options={employmentOptions} />
                  <DateField name={`work_experiences.${index}.start_date`} label="Start date" />
                  {!isCurrent && <DateField name={endName} label="End date" nullable />}
                  <div className="sm:col-span-2">
                    <TextAreaField
                      name={`work_experiences.${index}.description`}
                      label="What did you work on? (optional)"
                      placeholder="A short overview of your responsibilities and impact"
                      maxLength={1000}
                      rows={3}
                    />
                  </div>
                </div>
                <label className="inline-flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-accent"
                    {...form.register(currentName, {
                      onChange: (event) => {
                        if (event.target.checked) form.setValue(endName, null, { shouldDirty: true });
                      },
                    })}
                  />
                  I currently work here
                </label>
              </div>
            );
          }}
        </RepeatableList>
      )}
      {form.getFieldState("work_experiences").error?.message && (
        <p role="alert" className="text-sm text-red-500">
          {form.getFieldState("work_experiences").error?.message}
        </p>
      )}
    </div>
  );
}
