"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/services/AuthService";
import { useTheme } from "@/components/layout/Providers";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ShellUser } from "./DashboardShell";

interface TopBarProps {
  user: ShellUser | null;
  navOpen: boolean;
  onToggleNav: () => void;
}

/** Light/dark switch that renders the right icon until the theme hydrates. */
function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-foreground"
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Moon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

/** Avatar-style initial for the menu button. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

/** Top bar: mobile nav toggle, theme switch, and the account menu with logout. */
export function TopBar({ user, navOpen, onToggleNav }: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async (): Promise<void> => {
    setSigningOut(true);
    const result = await new AuthService(createSupabaseBrowserClient()).signOut();
    setSigningOut(false);
    setMenuOpen(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Signed out. See you soon!");
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onToggleNav}
        aria-expanded={navOpen}
        aria-controls="dashboard-sidebar"
        aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <Menu aria-hidden="true" className="h-4 w-4" />
      </button>

      <span className="font-display text-sm font-semibold tracking-tight text-foreground lg:hidden">
        Dashboard
      </span>

      <div className="ml-auto flex items-center gap-2">
        <ThemeButton />

        {user ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm backdrop-blur-xl transition-colors hover:border-accent/40"
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-xs font-semibold text-white"
              >
                {initialOf(user.name)}
              </span>
              <span className="hidden max-w-32 truncate text-foreground sm:inline">{user.name}</span>
              <ChevronDown
                aria-hidden="true"
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen ? (
              <div
                id="account-menu"
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-strong hover:text-foreground disabled:opacity-60"
                >
                  {signingOut ? <Spinner /> : <LogOut aria-hidden="true" className="h-4 w-4" />}
                  {signingOut ? "Signing out…" : "Log out"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Skeleton className="h-9 w-24 rounded-full" />
        )}
      </div>
    </header>
  );
}
