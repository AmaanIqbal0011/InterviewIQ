"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { siteConfig } from "@/lib/siteConfig";
import { Button } from "@/components/ui/Button";

interface DashboardErrorProps {
  /** Next 16 error boundary prop — re-renders the segment on failure. */
  error: Error & { digest?: string };
  retry: () => void;
}

/**
 * Route-segment error boundary for the dashboard. Production error messages
 * are intentionally generic, so we log the detail and show friendly copy.
 */
export default function DashboardError({ error, retry }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard failed to load:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
    >
      <span
        aria-hidden="true"
        className="grid h-12 w-12 place-items-center rounded-full border border-warning/40 bg-warning/10 text-warning"
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
        We couldn&apos;t load your dashboard
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Something went wrong on our side. Your data is safe — try again in a
        moment.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={retry}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Try again
        </Button>
        <Button href={siteConfig.routes.login} variant="ghost">
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
