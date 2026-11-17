import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "accent";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-border bg-surface text-muted-foreground",
  accent: "border-accent/30 bg-accent/10 text-accent",
};

export function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide backdrop-blur-xl",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
