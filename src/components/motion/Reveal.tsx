"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DEFAULT_REVEAL_DURATION, EASE_OUT, REVEAL_VIEWPORT } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/** Scroll-reveal wrapper — renders static content when motion is reduced. */
export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: DEFAULT_REVEAL_DURATION, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}
