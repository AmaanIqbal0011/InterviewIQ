"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormProvider, useForm, type FieldPath, type SubmitHandler } from "react-hook-form";
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { AboutYouStep } from "@/components/onboarding/steps/AboutYouStep";
import { EducationStep } from "@/components/onboarding/steps/EducationStep";
import { CareerTargetStep } from "@/components/onboarding/steps/CareerTargetStep";
import { InterviewSetupStep } from "@/components/onboarding/steps/InterviewSetupStep";
import { completeOnboardingAction, saveStepAction } from "@/app/(protected)/onboarding/actions";
import { onboardingSchemas, type OnboardingDraft } from "@/lib/validation/onboardingSchemas";

const stepContent = [
  { title: "About you", description: "A few details help us make this feel like your space." },
  { title: "Your background", description: "Share the education that has shaped your experience." },
  { title: "Your target", description: "Tell us where you are headed and the skills you want to practice." },
  { title: "Interview setup", description: "Choose how your practice rounds should feel." },
] as const;

interface OnboardingWizardProps {
  initialStep: number;
  initialValues: OnboardingDraft;
}

export function OnboardingWizard({ initialStep, initialValues }: OnboardingWizardProps) {
  const [step, setStep] = useState(Math.min(4, Math.max(1, initialStep)));
  const [isSaving, setIsSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const form = useForm<OnboardingDraft>({
    mode: "onSubmit",
    defaultValues: initialValues,
  });
  const currentStep = stepContent[step - 1];

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function applyValidationIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
    form.clearErrors();
    const details: string[] = [];
    for (const issue of issues) {
      const field = issue.path.map(String).join(".");
      if (field) form.setError(field as FieldPath<OnboardingDraft>, { type: "validate", message: issue.message });
      if (issue.message && !details.includes(issue.message)) details.push(issue.message);
    }
    setFormMessage(["A couple of details need your attention.", ...details].join(" "));
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  const onSubmit: SubmitHandler<OnboardingDraft> = async (values) => {
    setFormMessage("");
    form.clearErrors();

    let payload: unknown;
    switch (step) {
      case 1: {
        const parsed = onboardingSchemas.aboutYou.safeParse({
          full_name: values.full_name,
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
        const parsed = onboardingSchemas.careerTarget.safeParse({
          career_goal: {
            target_role: values.career_goal.target_role,
            target_industry: values.career_goal.target_industry,
            experience_level: values.career_goal.experience_level,
            target_companies: values.career_goal.target_companies,
          },
          top_skills: values.top_skills,
        });
        if (!parsed.success) {
          applyValidationIssues(parsed.error.issues);
          return;
        }
        payload = parsed.data;
        break;
      }
      case 4: {
        const parsed = onboardingSchemas.interviewSetup.safeParse({
          career_goal: {
            interview_type: values.career_goal.interview_type,
            difficulty: values.career_goal.difficulty,
            interview_language: values.career_goal.interview_language,
            practice_goals: values.career_goal.practice_goals,
            additional_notes: values.career_goal.additional_notes,
          },
          interview_language_proficiency: values.interview_language_proficiency,
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
        return;
      }

      if (step === 4) {
        const completion = await completeOnboardingAction();
        if (!completion.ok) {
          setFormMessage(completion.message);
          return;
        }
        router.push("/dashboard");
        router.refresh();
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
      case 3: return <CareerTargetStep />;
      default: return <InterviewSetupStep />;
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
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
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold tracking-tight text-foreground outline-none sm:text-3xl">
              {currentStep.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>
          </div>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22, ease: "easeOut" }} className="mt-7">
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
              {formMessage && <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formMessage}</p>}
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || isSaving} className="w-full sm:w-auto">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  {isSaving ? "Saving…" : step === 4 ? "Finish and go to dashboard" : "Save and continue"}
                  {step < 4 && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                </Button>
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
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your data is used only to personalize your interviews.</p>
          </div>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">Your progress is saved as you go, so you can come back whenever you&apos;re ready.</p>
        </aside>
      </div>
    </main>
  );
}
