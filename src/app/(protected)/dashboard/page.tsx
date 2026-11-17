import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthGuard } from "@/guards/AuthGuard";
import { InterviewRepository } from "@/repositories/InterviewRepository";
import { ProfileRepository } from "@/repositories/ProfileRepository";
import { ResumeRepository } from "@/repositories/ResumeRepository";
import { DashboardService } from "@/services/DashboardService";
import {
  DashboardSkeleton,
  DashboardStatsSkeleton,
  RecentInterviewsSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
import { ResumeStatusCard } from "@/components/dashboard/ResumeStatusCard";
import { StartInterviewCard } from "@/components/dashboard/StartInterviewCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Signed-in landing page: resolves the session, assembles the dashboard
 * payload through DashboardService, and renders each section. The layout
 * above has already guaranteed onboarding is complete.
 */
async function DashboardContent() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const user = await new AuthGuard(supabase).requireUser();

  const data = await createDashboardService(supabase).getDashboardOverviewData(user);

  return (
    <div className="space-y-6">
      <WelcomeHeader name={data.profile.fullName || user.displayName} />

      <div className="grid gap-4 sm:grid-cols-2">
        <StartInterviewCard />
        <ResumeStatusCard resume={data.resume} />
      </div>

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStatsContent userId={user.id} />
      </Suspense>

      <Suspense fallback={<RecentInterviewsSkeleton />}>
        <RecentInterviewsContent userId={user.id} />
      </Suspense>
    </div>
  );
}

async function DashboardStatsContent({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const stats = await createDashboardService(supabase).getStats(userId);
  return <StatsRow stats={stats} />;
}

async function RecentInterviewsContent({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const interviews = await createDashboardService(supabase).getRecentInterviews(userId);
  return <RecentInterviews interviews={interviews} />;
}

function createDashboardService(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): DashboardService {
  return new DashboardService(
    new ProfileRepository(supabase),
    new InterviewRepository(supabase),
    new ResumeRepository(supabase),
  );
}

/**
 * Reading cookies makes this route dynamic, and `cacheComponents` requires any
 * cookie read to sit behind a Suspense boundary.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
