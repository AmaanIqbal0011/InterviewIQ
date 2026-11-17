import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MessageSquareText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthGuard } from "@/guards/AuthGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InterviewRepository } from "@/repositories/InterviewRepository";
import { InterviewTurnRepository } from "@/repositories/InterviewTurnRepository";
import { InterviewHistoryService } from "@/services/InterviewHistoryService";
import type { InterviewEvaluation } from "@/models/InterviewTurn";
import { ReportSkeleton } from "./ReportSkeleton";

export const metadata: Metadata = {
  title: "Interview Report",
  robots: { index: false, follow: false },
};

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default function ReportPage({ params }: ReportPageProps) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent params={params} />
    </Suspense>
  );
}

async function ReportContent({ params }: ReportPageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const user = await new AuthGuard(supabase).requireUser();
  const service = new InterviewHistoryService(
    new InterviewRepository(supabase),
    new InterviewTurnRepository(supabase),
  );
  const report = await service.getReportForUser(user.id, id);

  if (!report) notFound();

  const { interview, turns } = report;
  const formattedDate = formatDate(interview.createdAt);
  const isInProgress = interview.status === "in_progress";

  return (
    <main
      id="main-content"
      className="relative isolate min-h-[100dvh] overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10"
    >
      <div aria-hidden="true" className="grid-backdrop pointer-events-none absolute inset-0 opacity-30" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Button href="/dashboard" variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to dashboard
          </Button>
          <Badge variant={interview.status === "completed" ? "accent" : "default"}>
            {interview.status === "completed" ? (
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {statusLabel(interview.status)}
          </Badge>
        </header>

        <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Card className="min-w-0 border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-accent-3/10 p-6 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-accent">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Interview
            </p>
            <h1 className="mt-3 break-words font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {interview.role}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{formattedDate}</p>
            {isInProgress ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Your interview is still in progress. Continue when you’re ready.
                </p>
                <Button href={`/interview/${encodeURIComponent(interview.id)}/chat`} size="sm">
                  Continue interview
                </Button>
              </div>
            ) : null}
          </Card>

          <Card className="flex min-w-40 flex-col justify-center p-6 sm:min-w-48 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overall score
            </p>
            <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
              {interview.overallScore === null
                ? "—"
                : `${Math.round(interview.overallScore)}%`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {interview.overallScore === null ? "No evaluated answers" : "Average across answers"}
            </p>
          </Card>
        </section>

        <section aria-labelledby="turns-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
                Your responses
              </p>
              <h2
                id="turns-heading"
                className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                Interview turns
              </h2>
            </div>
            <Badge>{turns.length} {turns.length === 1 ? "turn" : "turns"}</Badge>
          </div>

          {turns.length > 0 ? (
            <ol className="space-y-4">
              {turns.map((turn) => (
                <li key={turn.id}>
                  <TurnCard
                    turnNumber={turn.turnIndex + 1}
                    question={turn.questionText}
                    answer={turn.answerText}
                    evaluation={turn.evaluation}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <Card className="flex flex-col items-center px-5 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
                <MessageSquareText aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">No turns yet</h3>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                Questions and answers will appear here once they have been saved.
              </p>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function TurnCard({
  turnNumber,
  question,
  answer,
  evaluation,
}: {
  turnNumber: number;
  question: string;
  answer: string | null;
  evaluation: InterviewEvaluation | null;
}) {
  return (
    <Card className="min-h-[20rem] min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          Question {turnNumber}
        </h3>
        {evaluation?.score !== undefined ? (
          <Badge variant="accent">Score {evaluation.score}/10</Badge>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Question
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {question}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your answer
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {answer ?? "This question has not been answered yet."}
          </p>
        </div>

        {evaluation && answer !== null ? (
          <EvaluationDetails evaluation={evaluation} />
        ) : null}
      </div>
    </Card>
  );
}

function EvaluationDetails({ evaluation }: { evaluation: InterviewEvaluation }) {
  const metrics = [
    ["Relevance", evaluation.relevance],
    ["Depth", evaluation.depth],
    ["Clarity", evaluation.clarity],
  ] as const;
  const strengths = evaluation.strengths ?? [];
  const improvements = [
    ...(evaluation.gaps ?? []),
    ...asLines(evaluation.improvements),
  ];

  return (
    <section aria-label="AI evaluation" className="border-t border-border/70 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">AI evaluation</p>
        {evaluation.fallback ? <Badge>Automated fallback scoring</Badge> : null}
      </div>

      {metrics.some(([, score]) => score !== undefined) ? (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {metrics.map(([label, score]) =>
            score === undefined ? null : (
              <div key={label} className="rounded-lg border border-border bg-surface px-3 py-2">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {score}/10
                </dd>
              </div>
            ),
          )}
        </dl>
      ) : null}

      {asLines(evaluation.feedback).length > 0 ? (
        <div className="mt-3 space-y-1">
          {asLines(evaluation.feedback).map((line, index) => (
            <p
              key={`${index}-${line}`}
              className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {strengths.length > 0 || improvements.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 ? (
            <EvaluationList label="Strengths" items={strengths} />
          ) : null}
          {improvements.length > 0 ? (
            <EvaluationList label="Areas to improve" items={improvements} />
          ) : null}
        </div>
      ) : null}

      {evaluation.suggestedFollowUp ? (
        <p className="mt-4 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Suggested follow-up: </span>
          {evaluation.suggestedFollowUp}
        </p>
      ) : null}
    </section>
  );
}

function EvaluationList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground">{label}</h4>
      <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function asLines(value: string | string[] | undefined): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  return value ?? [];
}

function statusLabel(status: string): string {
  switch (status) {
    case "setup":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "abandoned":
      return "Abandoned";
    default:
      return status;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
