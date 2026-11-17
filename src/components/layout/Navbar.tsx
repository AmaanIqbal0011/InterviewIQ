"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/lib/motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/services/AuthService";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

/** Minimal, serializable identity the server passes down to the navbar. */
export interface NavbarUser {
  readonly name: string;
  readonly email: string;
}

interface NavbarProps {
  links: readonly NavItem[];
  /** Signed-in visitor resolved on the server, or null when signed out. */
  user: NavbarUser | null;
}

/** Avatar-style initial for the signed-in identity chip. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

/** Sticky top navigation with a keyboard-accessible mobile menu. */
export function Navbar({ links, user }: NavbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account dropdown on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const handleLogout = async (): Promise<void> => {
    setSigningOut(true);
    const result = await new AuthService(createSupabaseBrowserClient()).signOut();
    setSigningOut(false);
    setAccountOpen(false);
    setMenuOpen(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Signed out. See you soon!");
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || menuOpen
          ? "border-border bg-background/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4 md:h-20">
        <a
          href="#top"
          aria-label={`${siteConfig.brand.name} home`}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Logo name={siteConfig.brand.name} />
        </a>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-controls="account-menu"
                  className="flex h-9 items-center gap-2 rounded-full px-2 text-sm transition-colors hover:bg-surface"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-xs font-semibold text-white"
                  >
                    {initialOf(user.name)}
                  </span>
                  <span
                    className="max-w-32 truncate text-foreground"
                    title={user.name}
                  >
                    {user.name}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform",
                      accountOpen && "rotate-180",
                    )}
                  />
                </button>
                {accountOpen ? (
                  <div
                    id="account-menu"
                    role="menu"
                    aria-label="Account"
                    className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
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
                      {signingOut ? "Signing out…" : "Logout"}
                    </button>
                  </div>
                ) : null}
              </div>
              <Button href={siteConfig.routes.dashboard} size="sm" className="hidden sm:inline-flex">
                Dashboard
              </Button>
            </>
          ) : (
            <Button href={siteConfig.routes.login} variant="ghost" size="sm" className="hidden sm:inline-flex">
              Log in
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground md:hidden"
          >
            {menuOpen ? (
              <X aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Menu aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </Container>

      <AnimatePresence initial={false}>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
          >
            <Container className="flex flex-col gap-1 py-4">
              <nav aria-label="Mobile">
                <ul className="flex flex-col gap-1">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-xl px-3 py-2.5 text-base text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                {user ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-sm font-semibold text-white"
                      >
                        {initialOf(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground" title={user.name}>
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button href={siteConfig.routes.dashboard} className="w-full">
                      Dashboard
                    </Button>
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={handleLogout}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-6 text-sm font-medium text-foreground backdrop-blur-xl transition-all duration-200 hover:border-accent/40 hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-60"
                    >
                      {signingOut ? <Spinner /> : <LogOut aria-hidden="true" className="h-4 w-4" />}
                      {signingOut ? "Signing out…" : "Logout"}
                    </button>
                  </div>
                ) : (
                  <Button
                    href={siteConfig.routes.login}
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    Log in
                  </Button>
                )}
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
