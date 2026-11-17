import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentPropsWithoutRef<"div">;

/** Glassmorphism surface used across the page. */
export function Card({ className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface backdrop-blur-xl",
        className,
      )}
      {...rest}
    />
  );
}
