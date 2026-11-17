"use client";

import { useFormContext } from "react-hook-form";
import { ReviewSection } from "@/components/onboarding/fields";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

export function ReviewStep({ onEdit }: { onEdit: (step: number) => void }) {
  const values = useFormContext<OnboardingDraft>().getValues();
  const statusLabels: Record<OnboardingDraft["current_status"], string> = {
    student: "Student",
    working_professional: "Working professional",
    fresher: "Recent graduate",
    career_switcher: "Changing careers",
    other: "Other",
  };
  const chosenLanguage = values.languages.find((language) => language.is_interview_language)?.language;

  return (
    <div className="space-y-3">
      <ReviewSection
        title="About you"
        step={1}
        onEdit={onEdit}
        items={[
          values.full_name,
          `${values.city}, ${values.country}`,
          statusLabels[values.current_status],
        ]}
      />
      <ReviewSection
        title="Education"
        step={2}
        onEdit={onEdit}
        items={values.education.map((entry) =>
          `${entry.level.replaceAll("_", " ")} · ${entry.institution}${entry.field_of_study ? ` · ${entry.field_of_study}` : ""}`,
        )}
      />
      <ReviewSection
        title="Work experience"
        step={3}
        onEdit={onEdit}
        items={values.no_experience
          ? ["No experience yet — ready to start practicing"]
          : values.work_experiences.map((entry) => `${entry.job_title} · ${entry.company}`)}
      />
      <ReviewSection
        title="Skills"
        step={4}
        onEdit={onEdit}
        items={values.skills.map((skill) => `${skill.name} · ${skill.level}`)}
      />
      <ReviewSection
        title="Languages"
        step={5}
        onEdit={onEdit}
        items={values.languages.map((language) =>
          `${language.language} · ${language.proficiency}${language.is_interview_language ? " · AI interviewer language" : ""}`,
        )}
      />
      <ReviewSection
        title="Career goals & preferences"
        step={6}
        onEdit={onEdit}
        items={[
          values.career_goal.target_role,
          values.career_goal.target_industry || "Industry not specified",
          `${values.career_goal.experience_level} · ${values.career_goal.interview_type} · ${values.career_goal.difficulty}`,
          `AI interviewer: ${chosenLanguage || "Not selected"}`,
          ...(values.career_goal.target_companies.length > 0
            ? [`Companies: ${values.career_goal.target_companies.join(", ")}`]
            : []),
        ]}
      />
    </div>
  );
}
