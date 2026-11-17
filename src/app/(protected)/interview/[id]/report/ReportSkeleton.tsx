import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function ReportSkeleton() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-label="Loading interview report"
      className="relative isolate min-h-[100dvh] overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10"
    >
      <div aria-hidden="true" className="grid-backdrop pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>

        <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Card className="min-h-44 p-6 sm:p-8">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-64 max-w-full" />
            <Skeleton className="mt-3 h-4 w-36" />
          </Card>
          <Card className="flex min-h-44 min-w-40 flex-col justify-center p-6 sm:min-w-48 sm:p-8">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-10 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-40" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="space-y-4">
            {["turn-one", "turn-two"].map((turn) => (
              <Card key={turn} className="min-h-[20rem] p-5 sm:p-6">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-5 h-3 w-16" />
                <Skeleton className="mt-2 h-4 w-11/12" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <div className="mt-5 rounded-xl border border-border bg-surface/70 p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-10/12" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
                <Skeleton className="mt-4 h-3 w-24" />
              </Card>
            ))}
          </div>
        </section>
      </div>
      <span className="sr-only">Loading</span>
    </main>
  );
}
