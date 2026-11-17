"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";

interface AppChromeProps {
  /** Server-rendered, session-aware navbar handed in from the layout. */
  navbar: ReactNode;
  children: ReactNode;
}

/**
 * Routes where the marketing chrome would get in the way — auth screens and
 * the signed-in app both render edge to edge instead.
 */
const CHROMELESS_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/dashboard",
  "/onboarding",
  "/interview",
  "/resume",
];

function isChromeless(pathname: string): boolean {
  return CHROMELESS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Swaps the landing chrome for a bare main region on app routes. */
export function AppChrome({ navbar, children }: AppChromeProps) {
  const pathname = usePathname();

  if (isChromeless(pathname)) {
    return (
      <main id="main-content" className="flex-1">
        {children}
      </main>
    );
  }

  return (
    <>
      {navbar}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
