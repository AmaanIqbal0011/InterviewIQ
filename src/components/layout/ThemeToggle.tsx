"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/components/layout/Providers";

interface ThemeToggleProps {
  className?: string;
}

const emptySubscribe = (): (() => void) => () => {};
const getClientMounted = (): boolean => true;
const getServerMounted = (): boolean => false;

/** Light/dark switch — renders a neutral icon until the theme is hydrated. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted);
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-foreground",
        className,
      )}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Moon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
