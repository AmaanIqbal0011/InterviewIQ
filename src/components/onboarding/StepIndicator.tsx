"use client";

const STEPS = [
  "About you",
  "Education",
  "Experience",
  "Skills",
  "Languages",
  "Goals",
  "Review",
] as const;

export function StepIndicator({ step }: { step: number }) {
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Step <span className="text-foreground">{step}</span> of {STEPS.length}
        </p>
        <p className="text-xs font-medium text-accent">{STEPS[step - 1]}</p>
      </div>
      <div
        role="progressbar"
        aria-label={`Step ${step} of ${STEPS.length}`}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step}
        className="h-1.5 overflow-hidden rounded-full bg-border/70"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 transition-[width] duration-500"
          style={{ width: `${Math.max(progress, 10)}%` }}
        />
      </div>
      <ol className="mt-4 hidden grid-cols-7 gap-2 sm:grid" aria-hidden="true">
        {STEPS.map((title, index) => (
          <li key={title} className="space-y-1.5">
            <div className={`h-1 rounded-full ${index + 1 <= step ? "bg-accent/70" : "bg-border"}`} />
            <span className={`block truncate text-[10px] ${index + 1 === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {title}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
