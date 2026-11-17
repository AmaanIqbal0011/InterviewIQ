"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export interface ShellUser {
  readonly name: string;
  readonly email: string;
}

interface DashboardShellProps {
  user: ShellUser | null;
  children: ReactNode;
}

/**
 * Signed-in app frame: collapsible sidebar (drawer on mobile, static on
 * desktop) plus a top bar with the account menu. Client component because it
 * owns the mobile nav state; page content still arrives as server-rendered
 * children.
 */
export function DashboardShell({ user, children }: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
