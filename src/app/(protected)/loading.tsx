import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageLoader } from "@/components/ui/PageLoader";

export default function ProtectedLoading() {
  return (
    <DashboardShell user={null}>
      <PageLoader
        message="Loading your workspace…"
        className="min-h-[55vh] py-8"
      />
    </DashboardShell>
  );
}
