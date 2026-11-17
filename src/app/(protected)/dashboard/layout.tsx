import { Suspense } from "react";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthGuard } from "@/guards/AuthGuard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageLoader } from "@/components/ui/PageLoader";

function DashboardFallback() {
  return (
    <DashboardShell user={null}>
      <PageLoader message="Loading your dashboard…" className="min-h-[55vh] py-8" />
    </DashboardShell>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}

async function DashboardContent({ children }: { children: ReactNode }) {
  await connection();

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await new AuthGuard(supabase).requireOnboardingComplete();

  return (
    <DashboardShell
      user={{
        name: profile.fullName.trim() || user.displayName,
        email: user.email,
      }}
    >
      {children}
    </DashboardShell>
  );
}
