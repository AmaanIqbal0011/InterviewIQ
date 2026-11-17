import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { PASSWORD_RULES } from "@/lib/validation/authSchemas";

interface PasswordStrengthProps {
  /** Id referenced by the input's `aria-describedby`. */
  id: string;
  value: string;
  className?: string;
}

interface StrengthLevel {
  readonly label: string;
  readonly barClass: string;
  readonly textClass: string;
}

/** One entry per achievable score (0–4 rules satisfied). */
const LEVELS: readonly StrengthLevel[] = [
  { label: "Very weak", barClass: "bg-red-500", textClass: "text-red-600 dark:text-red-400" },
  { label: "Weak", barClass: "bg-red-500", textClass: "text-red-600 dark:text-red-400" },
  { label: "Fair", barClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-400" },
  { label: "Good", barClass: "bg-amber-400", textClass: "text-amber-600 dark:text-amber-400" },
  { label: "Strong", barClass: "bg-success", textClass: "text-success" },
];

function evaluatePasswordStrength(value: string): number {
  return PASSWORD_RULES.reduce((score, rule) => score + (rule.test(value) ? 1 : 0), 0);
}

/** Live strength meter plus the checklist of remaining requirements. */
export function PasswordStrength({ id, value, className }: PasswordStrengthProps) {
  const score = evaluatePasswordStrength(value);
  const level = LEVELS[score];
  const isEmpty = value.length === 0;

  return (
    <div id={id} className={cn("space-y-2", className)}>
      <div className="flex gap-1.5" aria-hidden="true">
        {PASSWORD_RULES.map((rule, index) => (
          <span
            key={rule.key}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < score ? level.barClass : "bg-border",
            )}
          />
        ))}
      </div>

      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.12em]",
          isEmpty ? "text-muted-foreground" : level.textClass,
        )}
      >
        {isEmpty ? "Password requirements" : `Strength: ${level.label}`}
      </p>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                passed ? "text-success" : "text-muted-foreground",
              )}
            >
              {passed ? (
                <Icon name="check" className="h-3 w-3 shrink-0" />
              ) : (
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-current" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
