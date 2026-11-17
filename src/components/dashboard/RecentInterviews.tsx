import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InterviewRow } from "@/components/dashboard/InterviewRow";
import type { InterviewSummary } from "@/services/DashboardService";

interface RecentInterviewsProps {
  interviews: readonly InterviewSummary[];
  heading?: string;
}

/**
 * List of the user's most recent interviews with an empty state.
 * Renders server-side; no client interactivity of its own.
 */
export function RecentInterviews({
  interviews,
  heading = "Recent Interviews",
}: RecentInterviewsProps) {
  const hasInterviews = interviews.length > 0;

  return (
    <Card className="min-h-[25rem] p-5 sm:p-6" aria-labelledby="recent-interviews-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="recent-interviews-heading"
          className="text-base font-semibold tracking-tight"
        >
          {heading}
        </h2>
        {hasInterviews ? (
          <Badge>{interviews.length}</Badge>
        ) : null}
      </div>

      {hasInterviews ? (
        <ul className="mt-4 divide-y divide-border/60">
          {interviews.map((interview) => (
            <li key={interview.id}>
              <InterviewRow interview={interview} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium">No interviews yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Start your first interview and your results will show up here.
          </p>
        </div>
      )}
    </Card>
  );
}
