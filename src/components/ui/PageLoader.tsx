"use client";

import { Logo } from "@/components/ui/Logo";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/lib/siteConfig";

interface PageLoaderProps {
  message?: string;
  className?: string;
}

/** Centered loading state shared by route and content-level boundaries. */
export function PageLoader({ message, className }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-h-[100svh] items-center justify-center px-6 py-12",
        className,
      )}
    >
      <Card className="flex flex-col items-center border-accent/20 px-10 py-8 text-center shadow-[0_20px_60px_-28px_var(--glow)]">
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-accent/50 via-accent-2/45 to-accent-3/40 opacity-60 blur-xl animate-pulse motion-reduce:animate-none"
          />
          <Logo
            name={siteConfig.brand.name}
            className="relative"
            markClassName="animate-pulse motion-reduce:animate-none"
          />
        </div>
        <span className="sr-only">Loading</span>
        {message ? (
          <p className="mt-5 max-w-sm text-sm text-muted-foreground">{message}</p>
        ) : null}
      </Card>
    </div>
  );
}
