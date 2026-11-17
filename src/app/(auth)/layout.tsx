import type { ReactNode } from "react";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Split-screen shell for every auth route: branded panel on large screens,
 * form-only on small ones. Reads no cookies, so the routes stay static.
 */
export default function AuthLayout({
  children,
}: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full flex-col lg:grid lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      <AuthBrandPanel />

      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="w-full max-w-md">
          <div className="mb-7 flex justify-center lg:hidden">
            <Logo name={siteConfig.brand.name} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
