import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthGuard } from "@/guards/AuthGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InterviewRepository } from "@/repositories/InterviewRepository";
import { InterviewTurnRepository } from "@/repositories/InterviewTurnRepository";
import { InterviewHistoryService } from "@/services/InterviewHistoryService";

export const metadata: Metadata = {
  title: "My Interviews",
  robots: { index: false, follow: false },
};

function InterviewsFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading your interviews…</p>
    </div>
  );
}

export default function InterviewsPage() {
  return (
    <Suspense fallback={<InterviewsFallback />}>
      <InterviewsContent />
    </Suspense>
  );
}

async function InterviewsContent() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await new AuthGuard(supabase).requireOnboardingComplete();
  const service = new InterviewHistoryService(
    new InterviewRepository(supabase),
    new InterviewTurnRepository(supabase),
  );
  const interviews = await service.getAllForUser(user.id);

  return (
    <DashboardShell
      user={{
        name: profile.fullName.trim() || user.displayName,
        email: user.email,
      }}
    >
      <section className="space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Your practice history
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My Interviews
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review every session and revisit the feedback from your answers.
          </p>
        </header>
        <RecentInterviews interviews={interviews} heading="All Interviews" />
      </section>
    </DashboardShell>
  );
}
