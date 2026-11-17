"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export interface InterviewMockupProps {
  interviewerName: string;
  interviewerRole: string;
  statusLabel: string;
  questionLabel: string;
  question: string;
  contextChip: string;
  roundChip: string;
  questionProgress: string;
  listeningLabel: string;
  syncedNote: string;
  latencyChip: string;
  startSeconds: number;
}

const WAVE_HEIGHTS = [
  35, 62, 44, 82, 56, 95, 70, 40, 86, 52, 66, 30, 76, 55, 90, 46, 60, 36, 80, 50, 72, 42, 88,
  58, 64, 32, 74, 48,
];

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Animated "live AI interview" card used in the hero. */
export function InterviewMockup(props: InterviewMockupProps) {
  const {
    interviewerName,
    interviewerRole,
    statusLabel,
    questionLabel,
    question,
    contextChip,
    roundChip,
    questionProgress,
    listeningLabel,
    syncedNote,
    latencyChip,
    startSeconds,
  } = props;
  const reducedMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(startSeconds);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setElapsed((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <motion.div
      animate={reducedMotion ? undefined : { y: [0, -10, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
    >
      <div className="rounded-[calc(1.5rem+1px)] bg-gradient-to-br from-accent/50 via-accent-2/30 to-accent-3/40 p-[1.5px] shadow-[0_40px_90px_-45px_var(--glow)]">
        <div className="relative overflow-hidden rounded-3xl bg-background/85 p-5 backdrop-blur-2xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-semibold text-white"
              >
                <Icon name="bot" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {interviewerName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{interviewerRole}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
                {statusLabel}
              </span>
              <span
                aria-label={`Interview elapsed time ${formatTime(elapsed)}`}
                className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] tabular-nums text-muted-foreground"
              >
                {formatTime(elapsed)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl rounded-tl-md border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {questionLabel}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{question}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{contextChip}</Badge>
            <Badge>{roundChip}</Badge>
          </div>

          <div
            aria-hidden="true"
            className="mt-5 flex h-12 items-center gap-[3px] overflow-hidden rounded-xl border border-border bg-surface px-3"
          >
            {WAVE_HEIGHTS.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="voice-bar w-[3px] shrink-0 rounded-full bg-gradient-to-b from-accent-3 to-accent"
                style={{
                  height: `${height}%`,
                  animationDelay: `${(index % 7) * 0.12}s`,
                  animationDuration: `${0.9 + (index % 5) * 0.14}s`,
                }}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_10px_24px_-10px_var(--glow)]"
              >
                <Icon name="mic" className="h-4 w-4" />
                <span className="absolute -inset-1 rounded-full border border-accent/40" />
              </span>
              <span className="text-xs text-muted-foreground">{listeningLabel}</span>
            </div>
            <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-muted-foreground">
              {questionProgress}
            </span>
          </div>

          <div
            className={cn(
              "float-slow absolute -bottom-4 right-4 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3.5 py-2 text-[11px] text-muted-foreground shadow-xl backdrop-blur-xl sm:flex",
            )}
          >
            <Icon name="check" className="h-3.5 w-3.5 text-success" />
            {syncedNote}
          </div>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="absolute -left-6 -top-6 hidden rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-xl backdrop-blur-xl lg:block"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <Icon name="sparkles" className="h-3.5 w-3.5 text-accent" />
          {latencyChip}
        </span>
      </span>
    </motion.div>
  );
}
