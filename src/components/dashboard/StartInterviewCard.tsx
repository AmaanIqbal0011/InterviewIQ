import { ArrowRight, Sparkles } from "lucide-react";
import { siteConfig } from "@/lib/siteConfig";
import { Button } from "@/components/ui/Button";

/**
 * Primary call-to-action: the one thing the dashboard wants you to do.
 * Renders as a gradient hero card above the fold.
 */
export function StartInterviewCard() {
  return (
    <section
      aria-labelledby="start-interview-heading"
      className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/15 via-surface to-accent-3/10 p-6 sm:p-8"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-medium tracking-wide text-accent">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            Ready when you are
          </span>
          <h2
            id="start-interview-heading"
            className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground"
          >
            Start New Interview
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Go live with your AI interviewer for a session tailored to your target role —
            follow-up questions, instant scoring, and a full report afterwards.
          </p>
        </div>
        <Button href={siteConfig.routes.newInterview} size="lg" className="shrink-0">
          Start now
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
