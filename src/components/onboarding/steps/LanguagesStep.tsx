"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Field, RepeatableList, SelectField } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const proficiencyOptions = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
];

export function LanguagesStep() {
  const form = useFormContext<OnboardingDraft>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "languages",
    keyName: "fieldKey",
  });

  function chooseInterviewLanguage(selectedIndex: number) {
    fields.forEach((_, index) => {
      form.setValue(`languages.${index}.is_interview_language`, index === selectedIndex, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Add the languages you speak, then choose the one you&apos;d like your AI interviewer to use.
      </p>
      <RepeatableList
        title="Languages you speak"
        count={fields.length}
        max={8}
        addLabel="Add a language"
        onAdd={() => append({
          language: "",
          proficiency: "fluent",
          is_interview_language: fields.length === 0,
        })}
        onRemove={(index) => {
          remove(index);
          if (fields.length > 1) {
            form.getValues("languages").forEach((_, languageIndex) => {
              form.setValue(
                `languages.${languageIndex}.is_interview_language`,
                languageIndex === 0,
                { shouldDirty: true },
              );
            });
          }
        }}
      >
        {(index) => (
          <div className="space-y-4" key={fields[index]?.fieldKey}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name={`languages.${index}.language`} label="Language" placeholder="e.g. English" maxLength={50} />
              <SelectField name={`languages.${index}.proficiency`} label="Proficiency" options={proficiencyOptions} />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-3.5 text-sm text-foreground">
              <input
                type="radio"
                name="interview-language"
                checked={Boolean(form.watch(`languages.${index}.is_interview_language`))}
                onChange={() => chooseInterviewLanguage(index)}
                className="h-4 w-4 accent-accent"
                aria-label={`Use ${form.watch(`languages.${index}.language`) || `language ${index + 1}`} for my interview`}
              />
              Preferred language for your AI interviewer
            </label>
          </div>
        )}
      </RepeatableList>
      {form.getFieldState("languages").error?.message && (
        <p role="alert" className="text-sm text-red-500">{form.getFieldState("languages").error?.message}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Your selected language is also used as the interview language in your preferences.
      </p>
    </div>
  );
}
