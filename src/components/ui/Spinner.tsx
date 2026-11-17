import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
}

/** Indeterminate activity indicator for buttons and loading states. */
export function Spinner({ className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
