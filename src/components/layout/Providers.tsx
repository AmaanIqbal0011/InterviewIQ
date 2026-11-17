"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

interface ProvidersProps {
  children: ReactNode;
}

type Theme = "light" | "dark";

interface ThemeContextValue {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

// The theme lives on the DOM: the inline <head> script paints it before React
// loads, and applyTheme() keeps it in sync on toggle. Reading it through
// useSyncExternalStore keeps server and client render identical — the server
// snapshot is the default ("dark"), and React adopts the real value right
// after hydrating instead of during render (which would break hydration).
const themeListeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function subscribeToTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function notifyThemeListeners(): void {
  themeListeners.forEach((listener) => listener());
}

const getThemeSnapshot = readTheme;
const getServerThemeSnapshot = (): Theme => "dark";

function ThemeProvider({ children }: ProvidersProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }

    notifyThemeListeners();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "theme") {
        return;
      }

      const nextTheme = event.newValue === "light" ? "light" : "dark";
      applyTheme(nextTheme);
      notifyThemeListeners();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within the app ThemeProvider");
  }

  return context;
}

// Hydration detection without an effect: the server snapshot is "not mounted",
// the browser snapshot is "mounted", so React re-renders once after hydrating.
const subscribe = (): (() => void) => () => undefined;
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

/** Toasts render client-side only, so they mount after hydration. */
function AppToaster() {
  const { resolvedTheme } = useTheme();
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return null;
  }

  return (
    <Toaster
      position="top-center"
      closeButton
      theme={resolvedTheme === "light" ? "light" : "dark"}
    />
  );
}

/** Theme + motion providers for the whole app (dark is the default). */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        {children}
        <AppToaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
