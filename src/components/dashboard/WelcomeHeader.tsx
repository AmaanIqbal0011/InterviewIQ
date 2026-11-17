interface WelcomeHeaderProps {
  name: string;
}

/** Personalised greeting shown at the top of the dashboard. */
export function WelcomeHeader({ name }: WelcomeHeaderProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? "there";

  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        Dashboard
      </span>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        Practice with your AI interviewer, track your scores, and walk in ready.
      </p>
    </div>
  );
}
