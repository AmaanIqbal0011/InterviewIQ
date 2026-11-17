"use client";

import { motion } from "framer-motion";
import { landingContentService } from "@/services/LandingContentService";
import { InterviewMockup } from "@/components/landing/InterviewMockup";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/lib/siteConfig";
import { DEFAULT_REVEAL_DURATION, EASE_OUT } from "@/lib/motion";

const EYEBROW = "Live voice interviews · 24/7";
const HEADLINE_LEAD = "Practice the interview.";
const HEADLINE_HIGHLIGHT = "Walk in ready.";
const BODY =
  "Upload your resume, pick your target role, and go one-on-one with a live AI avatar interviewer that follows up on every answer — then get a report of exactly what to improve.";
const POINTS: readonly string[] = [
  "Questions tailored to your actual resume",
  "Instant scores, strengths and weak areas",
  "A fresh report after every round",
];

/** Branded half of the auth split-screen. Hidden below the `lg` breakpoint. */
export function AuthBrandPanel() {
  const hero = landingContentService.getHero();

  return (
    <aside className="relative hidden overflow-x-hidden border-r border-border bg-gradient-to-br from-accent/25 via-background to-accent-3/15 lg:flex lg:flex-col lg:justify-between lg:overflow-y-auto lg:p-10 xl:p-14">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-accent-3/25 blur-3xl"
      />
      <div aria-hidden="true" className="grid-backdrop pointer-events-none absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DEFAULT_REVEAL_DURATION, ease: EASE_OUT }}
        className="relative max-w-lg"
      >
        <Logo name={siteConfig.brand.name} />

        <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent backdrop-blur-xl">
          <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
          {EYEBROW}
        </span>

        <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground xl:text-[2.6rem]">
          {HEADLINE_LEAD} <span className="gradient-text">{HEADLINE_HIGHLIGHT}</span>
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{BODY}</p>

        <ul className="mt-6 space-y-2.5">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/85">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"
              >
                <Icon name="check" className="h-3 w-3" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DEFAULT_REVEAL_DURATION, delay: 0.12, ease: EASE_OUT }}
        className="relative mt-10 max-w-lg"
      >
        <InterviewMockup {...hero.mockup} />
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="shield" className="h-3.5 w-3.5 shrink-0 text-accent" />
          {hero.trustNote}
        </p>
      </motion.div>
    </aside>
  );
}
