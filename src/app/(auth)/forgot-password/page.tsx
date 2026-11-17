import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

/**
 * Placeholder for the email-based password reset flow. The login form links
 * here so the route, chrome and layout are already wired up.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <>
          Remembered it after all?{" "}
          <Link
            href={siteConfig.routes.login}
            className="font-medium text-accent transition-colors hover:text-foreground"
          >
            Back to log in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-xl border border-border bg-surface-strong/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
        >
          Password reset is coming soon. For now, contact support and we will
          get you back into your account.
        </div>
        <Button href={siteConfig.routes.login} variant="secondary" className="w-full">
          Back to log in
        </Button>
      </div>
    </AuthCard>
  );
}
