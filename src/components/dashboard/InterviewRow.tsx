import { CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { InterviewSummary } from "@/services/DashboardService";

const STATUS_LABEL: Record<InterviewSummary["status"], string> = {
  setup: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

function scoreTone(score: number): string {
  if (score >= 70) return "border-success/30 bg-success/10 text-success";
  if (score >= 40) return "border-warning/30 bg-warning/10 text-warning";
  return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ScoreOrStatus({ interview }: { interview: InterviewSummary }) {
  if (interview.status === "in_progress") {
    return (
      <Badge className="shrink-0 whitespace-nowrap border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent sm:px-2.5 sm:text-[11px]">
        In progress
      </Badge>
    );
  }

  if (interview.status === "completed" && interview.score !== null) {
    const score = Math.round(interview.score);
    return (
      <Badge
        aria-label={`Score ${score} out of 100`}
        className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] ${scoreTone(score)}`}
      >
        {score}%
      </Badge>
    );
  }

  if (interview.status === "completed") {
    return (
      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
        Not scored
      </span>
    );
  }

  return (
    <Badge className="shrink-0 whitespace-nowrap px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px]">
      {STATUS_LABEL[interview.status]}
    </Badge>
  );
}

export function InterviewRow({ interview }: { interview: InterviewSummary }) {
  const interviewId = encodeURIComponent(interview.id);

  return (
    <div className="flex min-w-0 items-center rounded-lg transition-colors hover:bg-surface/70 focus-within:ring-2 focus-within:ring-accent">
      <Link
        href={`/interview/${interviewId}/report`}
        aria-label={`View ${interview.role} interview report`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-3 focus-visible:outline-none sm:gap-3"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
        >
          <Clock3 className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{interview.role}</p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CalendarDays aria-hidden="true" className="h-3 w-3 shrink-0" />
              {formatDate(interview.createdAt)}
            </span>
            {interview.status !== "in_progress" ? (
              <span className="truncate">{STATUS_LABEL[interview.status]}</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ScoreOrStatus interview={interview} />
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
        </div>
      </Link>

      {interview.status === "in_progress" ? (
        <Link
          href={`/interview/${interviewId}/chat`}
          aria-label={`Continue ${interview.role} interview`}
          className="mr-2 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:mr-3"
        >
          Continue
        </Link>
      ) : null}
    </div>
  );
}
