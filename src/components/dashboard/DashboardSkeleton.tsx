import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

function DashboardHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

function DashboardActionsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="min-h-[14rem] rounded-3xl border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-accent-3/10 p-6 sm:min-h-[25rem] sm:p-8">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="mt-4 h-7 w-56 max-w-full" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <Skeleton className="mt-6 h-11 w-32 rounded-full" />
      </Card>

      <Card className="flex min-h-[25rem] flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-18 rounded-full" />
          </div>
        </div>
        <div className="mt-auto flex justify-end">
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </Card>
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Loading interview statistics"
      className="grid gap-4 sm:grid-cols-3"
    >
      {["stats-total", "stats-average", "stats-last"].map((item) => (
        <Card key={item} className="flex min-h-[6.5rem] items-center gap-4 p-5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </Card>
      ))}
    </section>
  );
}

export function RecentInterviewsSkeleton() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Loading recent interviews"
    >
      <Card className="min-h-[25rem] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-7 rounded-full" />
        </div>
        <div className="mt-4 divide-y divide-border/60">
          {["recent-one", "recent-two", "recent-three", "recent-four", "recent-five"].map(
            (item) => (
              <div key={item} className="flex items-center gap-3 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40 max-w-full" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-4 w-10 shrink-0" />
              </div>
            ),
          )}
        </div>
      </Card>
    </section>
  );
}

/** Full-page fallback while the dashboard shell data is being resolved. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading dashboard">
      <DashboardHeaderSkeleton />
      <DashboardActionsSkeleton />
      <DashboardStatsSkeleton />
      <RecentInterviewsSkeleton />
    </div>
  );
}
