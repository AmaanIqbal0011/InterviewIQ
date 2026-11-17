"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormProvider, useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import type { FieldPath, SubmitHandler } from "react-hook-form";
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { AboutYouStep } from "@/components/onboarding/steps/AboutYouStep";
import { CareerGoalsStep } from "@/components/onboarding/steps/CareerGoalsStep";
import { EducationStep } from "@/components/onboarding/steps/EducationStep";
import { LanguagesStep } from "@/components/onboarding/steps/LanguagesStep";
import { ReviewStep } from "@/components/onboarding/steps/ReviewStep";
import { SkillsStep } from "@/components/onboarding/steps/SkillsStep";
import { WorkExperienceStep } from "@/components/onboarding/steps/WorkExperienceStep";
import { completeOnboardingAction, saveStepAction } from "@/app/(protected)/onboarding/actions";
import { onboardingSchemas } from "@/lib/validation/onboardingSchemas";
import type { OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const stepContent = [
  {
    title: "First, a little about you",
    description: "A few details help us make this feel like your space.",
  },
  {
    title: "Your learning journey",
    description: "Share the education that has shaped your experience.",
  },
  {
    title: "The work you’ve done",
    description: "Every role counts. It’s completely okay to be just getting started.",
  },
  {
    title: "What do you do best?",
    description: "Choose the strengths you’d like to put into practice.",
  },
  {
    title: "The languages you speak",
    description: "Choose the language you’d feel most comfortable interviewing in.",
  },
  {
    title: "Where are you headed?",
    description: "We’ll use your goals to make every practice round more relevant.",
  },
  {
    title: "One last look",
    description: "Make sure everything feels right. You can edit any section before finishing.",
  },
] as const;

interface OnboardingWizardProps {
  initialStep: number;
  initialValues: OnboardingDraft;
}

export function OnboardingWizard({ initialStep, initialValues }: OnboardingWizardProps) {
  const [step, setStep] = useState(Math.min(7, Math.max(1, initialStep)));
  const [isSaving, setIsSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const form = useForm<OnboardingDraft>({
    mode: "onSubmit",
    defaultValues: initialValues,
  });
  const currentStep = stepContent[step - 1];
  const languages = useWatch({ control: form.control, name: "languages" });
  const interviewLanguage =
    languages.find((language) => language.is_interview_language)?.language ?? "";

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function applyValidationIssues(
    issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  ) {
    form.clearErrors();
    const details: string[] = [];
    for (const issue of issues) {
      const field = issue.path.map(String).join(".");
      if (field) {
        form.setError(field as FieldPath<OnboardingDraft>, { type: "validate", message: issue.message });
      }
      if (issue.message && !details.includes(issue.message)) {
        details.push(issue.message);
      }
    }
    // Spell out the actual rule that failed — a generic banner alone leaves
    // the user guessing, especially when the failing path has no visible input.
    setFormMessage(["A couple of details need your attention.", ...details].join(" "));
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  function handleEdit(stepNumber: number) {
    setFormMessage("");
    form.clearErrors();
    setStep(stepNumber);
  }

  const onSubmit: SubmitHandler<OnboardingDraft> = async (values) => {
    setFormMessage("");
    form.clearErrors();
    if (step === 7) {
      setIsSaving(true);
      try {
        const result = await completeOnboardingAction();
        if (!result.ok) {
          setFormMessage(result.message);
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch {
        setFormMessage("We couldn't finish setting up your profile. Please try again.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    let payload: unknown;
    switch (step) {
      case 1: {
        const parsed = onboardingSchemas.aboutYou.safeParse({
          full_name: values.full_name,
          country: values.country,
          city: values.city,
          current_status: values.current_status,
        });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 2: {
        const parsed = onboardingSchemas.education.safeParse({ education: values.education });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 3: {
        const parsed = onboardingSchemas.workExperience.safeParse({
          no_experience: values.no_experience,
          work_experiences: values.work_experiences,
        });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 4: {
        const parsed = onboardingSchemas.skills.safeParse({ skills: values.skills });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 5: {
        const parsed = onboardingSchemas.languages.safeParse({ languages: values.languages });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 6: {
        const parsed = onboardingSchemas.careerGoals.safeParse({
          career_goal: {
            ...values.career_goal,
            interview_language: interviewLanguage,
          },
        });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      default:
        return;
    }

    setIsSaving(true);
    try {
      const result = await saveStepAction(step, payload);
      if (!result.ok) {
        setFormMessage(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<OnboardingDraft>, { type: "server", message });
        }
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
        return;
      }
      setStep(result.step);
    } catch {
      setFormMessage("We couldn't save your progress. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  function renderStep() {
    switch (step) {
      case 1: return <AboutYouStep />;
      case 2: return <EducationStep />;
      case 3: return <WorkExperienceStep />;
      case 4: return <SkillsStep />;
      case 5: return <LanguagesStep />;
      case 6: return <CareerGoalsStep interviewLanguage={interviewLanguage} />;
      default: return <ReviewStep onEdit={handleEdit} />;
    }
  }

  async function skipWorkExperience() {
    form.setValue("no_experience", true, { shouldDirty: true });
    form.setValue("work_experiences", [], { shouldDirty: true });
    await form.handleSubmit(onSubmit)();
  }

  return (
    <main className="relative min-h-svh overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-36 top-24 h-80 w-80 rounded-full bg-accent/10 blur-[100px]" />
        <div className="absolute -right-36 bottom-10 h-96 w-96 rounded-full bg-accent-3/10 blur-[120px]" />
      </div>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Logo name="InterviewIQ" />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">Your interview, your way</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-5xl gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        <Card className="overflow-hidden p-5 shadow-[0_28px_90px_-54px_var(--glow)] sm:p-8 lg:p-10">
          <StepIndicator step={step} />
          <div className="mt-8 min-h-28">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              A more personal practice
            </div>
            <h1
              id="step-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold tracking-tight text-foreground outline-none sm:text-3xl"
            >
              {currentStep.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {currentStep.description}
            </p>
          </div>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="mt-7"
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              {formMessage && (
                <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {formMessage}
                </p>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => handleEdit(step - 1)}
                  disabled={step === 1 || isSaving}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  {step === 3 && (
                    <Button
                      variant="secondary"
                      onClick={skipWorkExperience}
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      Skip this step
                    </Button>
                  )}
                  <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving
                      ? "Saving…"
                      : step === 7
                        ? "Finish and go to dashboard"
                        : "Save and continue"}
                    {step < 7 && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </form>
          </FormProvider>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <LockKeyhole aria-hidden="true" className="h-4 w-4 text-accent" />
              Your information stays yours
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your data is used only to personalize your interviews.
            </p>
          </div>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Your progress is saved as you go, so you can come back whenever you&apos;re ready.
          </p>
        </aside>
      </div>
    </main>
  );
}
