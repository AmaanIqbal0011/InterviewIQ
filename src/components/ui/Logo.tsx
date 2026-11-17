import { cn } from "@/lib/cn";

interface LogoProps {
  name: string;
  className?: string;
  markClassName?: string;
}

/** Gradient wordmark with a waveform mark. */
export function Logo({ name, className, markClassName }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent via-accent-2 to-accent-3 shadow-[0_8px_24px_-10px_var(--glow)]",
          markClassName,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" aria-hidden="true">
          <path
            d="M4 10v4M8 7v10M12 4.5v15M16 7v10M20 10v4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="font-display text-[0.95rem] font-semibold tracking-tight text-foreground">
        {name}
      </span>
    </span>
  );
}
