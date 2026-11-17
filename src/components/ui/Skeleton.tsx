import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

/** Theme-aware loading block that respects the global reduced-motion rule. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg bg-foreground/5 motion-reduce:animate-none",
        className,
      )}
    />
  );
}
