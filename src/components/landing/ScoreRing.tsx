"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
}

/** Animated SVG score ring for the report preview. */
export function ScoreRing({ score, label, size = 132 }: ScoreRingProps) {
  const reducedMotion = useReducedMotion();
  const rawId = useId();
  const gradientId = `score-ring-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const restOffset = circumference * (1 - score / 100);

  return (
    <div
      role="img"
      aria-label={`${label}: ${score} out of 100`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="55%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent-3)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reducedMotion ? restOffset : circumference }}
          whileInView={{ strokeDashoffset: restOffset }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: reducedMotion ? 0 : 1.4, ease: EASE_OUT, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold text-foreground">
          {score}
          <span className="text-base text-muted-foreground">/100</span>
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
