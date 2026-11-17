"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { DEFAULT_REVEAL_DURATION, EASE_OUT } from "@/lib/motion";

interface AuthCardProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Glass panel that hosts the login, signup and recovery flows. */
export function AuthCard({ title, subtitle, children, footer, className }: AuthCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DEFAULT_REVEAL_DURATION, ease: EASE_OUT }}
      aria-labelledby="auth-title"
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-[0_40px_90px_-50px_var(--glow)] backdrop-blur-2xl sm:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />

      <header className="mb-6">
        <h1
          id="auth-title"
          tabIndex={-1}
          className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]"
        >
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </header>

      {children}

      {footer ? (
        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </motion.section>
  );
}
