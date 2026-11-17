"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/lib/motion";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export interface ConversationTurn {
  readonly role: "interviewer" | "candidate";
  readonly text: string;
}

interface ConversationProps {
  title: string;
  subtitle: string;
  liveLabel: string;
  turns: readonly ConversationTurn[];
  footerNote: string;
}

/** Animated mock conversation between the AI interviewer and the candidate. */
export function Conversation({ title, subtitle, liveLabel, turns, footerNote }: ConversationProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="rounded-[calc(1.5rem+1px)] bg-gradient-to-br from-accent/45 via-accent-2/25 to-accent-3/35 p-[1.5px] shadow-[0_40px_90px_-45px_var(--glow)]">
      <div className="overflow-hidden rounded-3xl bg-background/85 backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white"
            >
              <Icon name="bot" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Badge>
            <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
            {liveLabel}
          </Badge>
        </div>

        <div className="space-y-4 px-5 py-5">
          {turns.map((turn, index) => (
            <motion.div
              key={`${turn.role}-${index}`}
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: index * 0.3, duration: reducedMotion ? 0 : 0.5, ease: EASE_OUT }}
              className={cn("flex", turn.role === "candidate" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  turn.role === "interviewer"
                    ? "rounded-tl-md border border-border bg-surface text-foreground/90"
                    : "rounded-br-md bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_12px_28px_-16px_var(--glow)]",
                )}
              >
                <span className="sr-only">
                  {turn.role === "interviewer" ? "AI interviewer: " : "You: "}
                </span>
                {turn.text}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-4">
          <div aria-hidden="true" className="flex h-5 flex-1 items-center gap-[3px]">
            {[40, 70, 45, 90, 55, 75, 35, 60, 85, 50, 65, 40, 80, 55, 45, 70].map(
              (height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="voice-bar w-[3px] rounded-full bg-gradient-to-b from-accent-3 to-accent"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${(index % 6) * 0.11}s`,
                    animationDuration: `${0.95 + (index % 4) * 0.13}s`,
                  }}
                />
              ),
            )}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{footerNote}</span>
        </div>
      </div>
    </div>
  );
}
