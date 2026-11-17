/**
 * Shared motion constants. Kept typed as readonly tuples so they remain
 * assignable to framer-motion's `BezierDefinition` / `ViewportOptions`.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const REVEAL_VIEWPORT = { once: true, amount: 0.15 } as const;

export const DEFAULT_REVEAL_DURATION = 0.65;
