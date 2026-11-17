"use client";

import { useEffect, useState } from "react";
import type { AvatarState } from "@/lib/avatar/types";
import styles from "./AvatarRenderer.module.css";

type AvatarRendererProps = {
  state: AvatarState;
  mouthOpenness: number;
  name: string;
  caption?: string;
};

const STATE_LABELS: Record<AvatarState, string> = {
  idle: "Ready when you are",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking",
};

export function AvatarRenderer({
  state,
  mouthOpenness,
  name,
  caption,
}: AvatarRendererProps) {
  const [blinking, setBlinking] = useState(false);
  const safeOpenness = Math.min(1, Math.max(0, mouthOpenness));

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches) return;

    let blinkTimeout = 0;
    let reopenTimeout = 0;
    let active = true;
    const scheduleBlink = (): void => {
      blinkTimeout = window.setTimeout(() => {
        if (!active) return;
        setBlinking(true);
        reopenTimeout = window.setTimeout(() => {
          if (!active) return;
          setBlinking(false);
          scheduleBlink();
        }, 130);
      }, 3000 + Math.random() * 3000);
    };
    scheduleBlink();

    return () => {
      active = false;
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(reopenTimeout);
    };
  }, []);

  return (
    <section className={styles.avatar} data-state={state} aria-label={`${name}, interviewer`}>
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.ring} />
        <div className={styles.soundGlow} />
        <svg
          className={styles.portrait}
          viewBox="0 0 220 220"
          role="img"
          aria-label="Illustrated interviewer avatar"
        >
          <defs>
            <linearGradient id="avatar-bg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="avatar-shirt" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="1" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r="107" fill="url(#avatar-bg)" />
          <circle cx="110" cy="110" r="93" fill="rgba(255,255,255,0.12)" />
          <g className={styles.shoulders}>
            <path
              d="M37 220c6-40 31-63 73-63s67 23 73 63"
              fill="#24345c"
            />
            <path d="m83 164 27 31 27-31-7-10H90z" fill="#fff" />
            <path d="m110 195-9 25h18z" fill="#6d5df6" />
          </g>
          <g className={styles.head}>
            <path d="M75 91c0-34 14-54 36-54 25 0 39 20 39 54v29c0 31-17 50-40 50S75 151 75 120z" fill="#f2bc98" />
            <path d="M72 91c-5-31 6-62 38-66 26-4 49 12 51 41 1 11-2 23-5 30-3-16-9-24-20-30-14 8-34 11-62 8z" fill="#27304c" />
            <path d="M76 89c1-8 5-15 11-20m48 0c5 4 9 10 11 19" fill="none" stroke="#27304c" strokeLinecap="round" strokeWidth="8" />
            <g className={`${styles.eyes} ${blinking ? styles.blinking : ""}`}>
              <path d="M85 103c5-4 12-4 17 0m18 0c5-4 12-4 17 0" fill="none" stroke="#563d3d" strokeLinecap="round" strokeWidth="3" />
              <ellipse cx="94" cy="112" rx="3.5" ry="4.5" fill="#26314b" />
              <ellipse cx="126" cy="112" rx="3.5" ry="4.5" fill="#26314b" />
            </g>
            <path d="M86 96c5-3 11-3 16-1m18 0c5-2 11-2 16 1" fill="none" stroke="#27304c" strokeLinecap="round" strokeWidth="3" />
            <path d="M108 116c-1 6-3 11-4 14 3 2 7 2 10 0" fill="none" stroke="#d99476" strokeLinecap="round" strokeWidth="2" />
            <path d="M96 143c8 7 20 7 28 0" fill="none" stroke="#9e4f58" strokeLinecap="round" strokeWidth="2.5" />
            <g
              className={styles.mouth}
              style={{ transform: `scaleY(${0.25 + safeOpenness * 1.6})` }}
            >
              <ellipse cx="110" cy="143" rx="9" ry="4" fill="#793c4c" />
              <ellipse cx="110" cy="145" rx="5" ry="1.5" fill="#f4a8a2" />
            </g>
          </g>
        </svg>
        {state === "thinking" && (
          <span className={styles.thinkingDots}>
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <div className={styles.details}>
        <p className={styles.stateLabel} role="status" aria-live="polite">
          {STATE_LABELS[state]}
        </p>
        <h2 className={styles.name}>{name}</h2>
        {state === "speaking" && caption && (
          <p className={styles.caption} aria-label="Current question caption">
            {caption}
          </p>
        )}
      </div>
    </section>
  );
}
