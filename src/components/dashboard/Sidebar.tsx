"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Sparkles, X, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/lib/siteConfig";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ShellUser } from "./DashboardShell";

interface SidebarProps {
  user: ShellUser | null;
  /** Mobile drawer visibility; ignored on desktop where the rail is static. */
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: typeof LayoutDashboard;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: siteConfig.routes.dashboard, icon: LayoutDashboard },
  { label: "New Interview", href: siteConfig.routes.newInterview, icon: Sparkles },
  { label: "My Interviews", href: siteConfig.routes.interviews, icon: ClipboardList },
  { label: "Resume", href: siteConfig.routes.resume, icon: FileText },
];

/** Avatar-style initial shown when the account has no display name. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

/**
 * App navigation rail: static on desktop, off-canvas drawer on mobile with
 * overlay, Escape-to-close and scroll locking.
 */
export function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const nav = (
    <nav aria-label="Dashboard" className="flex-1 px-3 py-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== siteConfig.routes.interviews &&
              pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const account = user ? (
    <div className="flex items-center gap-3 border-t border-border px-4 py-4">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-sm font-semibold text-white"
      >
        {initialOf(user.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3 border-t border-border px-4 py-4">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-surface/40 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={siteConfig.routes.dashboard} aria-label={`${siteConfig.brand.name} dashboard`}>
            <Logo name={siteConfig.brand.name} />
          </Link>
        </div>
        {nav}
        {account}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div
            id="dashboard-sidebar"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Link href={siteConfig.routes.dashboard} onClick={onClose}>
                <Logo name={siteConfig.brand.name} />
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {nav}
            {account}
          </div>
        </div>
      ) : null}
    </>
  );
}
