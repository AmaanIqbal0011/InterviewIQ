"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/lib/motion";

export interface AccordionItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

interface AccordionProps {
  items: readonly AccordionItem[];
  defaultOpenId?: string;
  headingLevel?: 3 | 4;
  className?: string;
}

/** Accessible single-open accordion (native buttons + ARIA state). */
export function Accordion({
  items,
  defaultOpenId,
  headingLevel = 3,
  className,
}: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);
  const reducedMotion = useReducedMotion();
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface backdrop-blur-xl",
        className,
      )}
    >
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <Heading className="text-base font-semibold">
              <button
                type="button"
                id={`${item.id}-button`}
                aria-expanded={isOpen}
                aria-controls={`${item.id}-panel`}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:text-foreground sm:px-6"
              >
                <span className={cn(isOpen && "text-foreground")}>{item.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180 text-accent",
                  )}
                />
              </button>
            </Heading>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={`${item.id}-panel`}
                  role="region"
                  aria-labelledby={`${item.id}-button`}
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.3, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
