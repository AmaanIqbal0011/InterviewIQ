import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthGuard } from "@/guards/AuthGuard";
import { OnboardingService } from "@/services/OnboardingService";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = {
  title: "Personalize your interviews",
  robots: { index: false, follow: false },
};

function OnboardingFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Loading your profile…</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  // Session + profile reads are request-time only: supabase-js compares token
  // expiry against Date.now(), which is unstable while prerendering.
  await connection();

  const supabase = await createSupabaseServerClient();
  const user = await new AuthGuard(supabase).requireOnboardingIncomplete();

  const progress = await new OnboardingService(supabase).getFullProfile(user.id);

  const initialValues = {
    full_name: progress.profile.fullName || user.fullName,
    country: progress.profile.country ?? "",
    city: progress.profile.city ?? "",
    current_status: progress.profile.currentStatus ?? "student",
    education: progress.education.map((entry) => ({
      id: entry.id,
      level: entry.level,
      institution: entry.institution,
      field_of_study: entry.fieldOfStudy ?? "",
      start_year: entry.startYear,
      end_year: entry.endYear,
      is_current: entry.isCurrent,
      grade: entry.grade ?? "",
    })),
    no_experience: progress.workExperiences.length === 0,
    work_experiences: progress.workExperiences.map((entry) => ({
      id: entry.id,
      job_title: entry.jobTitle,
      company: entry.company,
      employment_type: entry.employmentType,
      start_date: entry.startDate,
      end_date: entry.endDate,
      is_current: entry.isCurrent,
      description: entry.description ?? "",
    })),
    skills: progress.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
    })),
    languages: progress.languages.map((language) => ({
      id: language.id,
      language: language.language,
      proficiency: language.proficiency,
      is_interview_language: language.isInterviewLanguage,
    })),
    career_goal: progress.careerGoal
      ? {
          target_role: progress.careerGoal.targetRole,
          target_industry: progress.careerGoal.targetIndustry ?? "",
          experience_level: progress.careerGoal.experienceLevel,
          target_companies: progress.careerGoal.targetCompanies,
          interview_type: progress.careerGoal.interviewType,
          difficulty: progress.careerGoal.difficulty,
          interview_language: progress.careerGoal.interviewLanguage,
          additional_notes: progress.careerGoal.additionalNotes ?? "",
        }
      : {
          target_role: "",
          target_industry: "",
          experience_level: "entry" as const,
          target_companies: [],
          interview_type: "mixed" as const,
          difficulty: "medium" as const,
          interview_language:
            progress.languages.find((language) => language.isInterviewLanguage)?.language ?? "",
          additional_notes: "",
        },
  };

  return (
    <OnboardingWizard
      initialStep={progress.profile.onboardingStep}
      initialValues={initialValues}
    />
  );
}
