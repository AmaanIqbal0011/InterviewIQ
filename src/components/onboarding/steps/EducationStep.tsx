"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Field, RepeatableList, SelectField, YearPicker } from "@/components/onboarding/fields";
import { MAX_EDUCATION_END_YEAR, type OnboardingDraft } from "@/lib/validation/onboardingSchemas";

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
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "education",
    keyName: "fieldKey",
  });

  return (
    <div className="space-y-3">
      <RepeatableList
        title="Your education"
        description="Start with the most recent. At least one entry is needed."
        count={fields.length}
        max={10}
        addLabel="Add education"
        onAdd={() => append({
          level: "bachelors",
          institution: "",
          field_of_study: "",
          start_year: new Date().getFullYear(),
          end_year: null,
          is_current: false,
          grade: "",
        })}
        onRemove={remove}
      >
        {(index) => {
          const currentName = `education.${index}.is_current` as const;
          const isCurrent = form.watch(currentName);
          const levelName = `education.${index}.level` as const;
          const institutionName = `education.${index}.institution` as const;
          const fieldName = `education.${index}.field_of_study` as const;
          const startName = `education.${index}.start_year` as const;
          const endName = `education.${index}.end_year` as const;
          const gradeName = `education.${index}.grade` as const;
          return (
            <div className="space-y-4" key={fields[index]?.fieldKey}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name={levelName} label="Education level" options={levelOptions} />
                <Field name={institutionName} label="Institution" placeholder="School or university" maxLength={160} />
                <Field name={fieldName} label="Field of study" placeholder="e.g. Computer science" maxLength={120} />
                <Field name={gradeName} label="Grade (optional)" placeholder="e.g. 3.8 GPA" maxLength={30} />
                <YearPicker name={startName} label="Start year" />
                <YearPicker
                  name={endName}
                  label={isCurrent ? "Expected end year (optional)" : "End year (required)"}
                  maxYear={MAX_EDUCATION_END_YEAR}
                  nullable
                />
              </div>
              <label className="inline-flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-accent"
                  {...form.register(currentName)}
                />
                I&apos;m currently studying here
              </label>
            </div>
          );
        }}
      </RepeatableList>
      {form.getFieldState("education").error?.message && (
        <p role="alert" className="text-sm text-red-500">
          {form.getFieldState("education").error?.message}
        </p>
      )}
    </div>
  );
}
