import { cn } from "@/lib/cn";

export const fieldLabelStyles = "block text-sm font-medium text-foreground";

export const fieldErrorStyles =
  "mt-1.5 text-xs font-medium text-red-600 dark:text-red-400";

const fieldBase =
  "h-11 w-full rounded-xl border text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-xl transition-colors focus:outline-none focus:ring-2";

const idleStyles = "border-border focus:border-accent/50 focus:ring-accent/25";

const errorStyles = "border-red-500/70 focus:border-red-500/70 focus:ring-red-500/25";

/**
 * Shared auth field styling. Error styling is composed here rather than via an
 * `aria-invalid:` variant so it stays in sync with the inline error message.
 *
 * @param paddingClass - override when the input carries a trailing control.
 */
export function authInputStyles(hasError: boolean, paddingClass = "px-3.5"): string {
  return cn(fieldBase, hasError ? errorStyles : idleStyles, paddingClass);
}
