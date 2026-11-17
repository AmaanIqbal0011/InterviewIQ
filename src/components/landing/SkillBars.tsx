"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

export interface SkillBarView {
  readonly label: string;
  readonly value: number;
}

interface SkillBarsProps {
  skills: readonly SkillBarView[];
}

/** Animated skill bars for the report preview. */
export function SkillBars({ skills }: SkillBarsProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="space-y-5">
      {skills.map((skill, index) => (
        <div key={skill.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{skill.label}</span>
            <span className="tabular-nums text-muted-foreground">{skill.value}%</span>
          </div>
          <div
            role="img"
            aria-label={`${skill.label}: ${skill.value} out of 100`}
            className="mt-2 h-2 overflow-hidden rounded-full border border-border bg-background/60"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3"
              initial={{ width: reducedMotion ? `${skill.value}%` : "0%" }}
              whileInView={{ width: `${skill.value}%` }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{
                duration: reducedMotion ? 0 : 1,
                ease: EASE_OUT,
                delay: 0.15 + index * 0.12,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
