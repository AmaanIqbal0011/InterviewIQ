import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeStatusCard } from "@/components/dashboard/ResumeStatusCard";
import { AuthGuard } from "@/guards/AuthGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumeService } from "@/services/resume/createResumeService";

export const metadata: Metadata = {
  title: "Resume",
  robots: { index: false, follow: false },
};

function ResumeFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading your resume…</p>
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense fallback={<ResumeFallback />}>
      <ResumeContent />
    </Suspense>
  );
}

async function ResumeContent() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await new AuthGuard(supabase).requireOnboardingComplete();
  const resume = await createResumeService(supabase).getState(user.id);

  return (
    <DashboardShell
      user={{
        name: profile.fullName.trim() || user.displayName,
        email: user.email,
      }}
    >
      <section className="mx-auto w-full max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Your profile
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Resume
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep your parsed experience up to date for more relevant interview practice.
          </p>
        </header>
        <ResumeStatusCard resume={resume} />
      </section>
    </DashboardShell>
  );
}
