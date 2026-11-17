import { CalendarClock, ClipboardList, Target } from "lucide-react";
import type { InterviewStats } from "@/repositories/InterviewRepository";
import { Card } from "@/components/ui/Card";

interface StatsRowProps {
  stats: InterviewStats;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAverage(score: number | null): string {
  if (score === null) return "-";
  return `${Math.round(score)}%`;
}

/** Compact KPI strip: totals, average score, and last interview date. */
export function StatsRow({ stats }: StatsRowProps) {
  const items = [
    {
      label: "Total interviews",
      value: String(stats.totalInterviews),
      hint: stats.totalInterviews === 0 ? "No sessions yet" : "All time",
      icon: ClipboardList,
    },
    {
      label: "Average score",
      value: formatAverage(stats.averageScore),
      hint: stats.averageScore === null ? "Finish an interview to score" : "Across scored sessions",
      icon: Target,
    },
    {
      label: "Last interview",
      value: formatDate(stats.lastInterviewAt),
      hint: stats.lastInterviewAt === null ? "You're all caught up" : "Most recent session",
      icon: CalendarClock,
    },
  ];

  return (
    <section aria-label="Interview statistics" className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="flex items-center gap-4 p-5">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-strong text-accent"
          >
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="font-display text-xl font-semibold tracking-tight text-foreground">
              {item.value}
            </p>
            <p className="truncate text-[11px] text-muted-foreground/80">{item.hint}</p>
          </div>
        </Card>
      ))}
    </section>
  );
}
