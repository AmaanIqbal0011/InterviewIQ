import { Suspense } from "react";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthGuard } from "@/guards/AuthGuard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageLoader } from "@/components/ui/PageLoader";

function ProtectedFallback() {
  return (
    <DashboardShell user={null}>
      <PageLoader message="Checking your session…" className="min-h-[55vh] py-8" />
    </DashboardShell>
  );
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProtectedFallback />}>
      <ProtectedContent>{children}</ProtectedContent>
    </Suspense>
  );
}

async function ProtectedContent({ children }: { children: ReactNode }) {
  await connection();

  const supabase = await createSupabaseServerClient();
  await new AuthGuard(supabase).requireUser();
  return children;
}
