import { Info, Loader, Mic, Pause, Send, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import type { VoiceLoopState } from "@/lib/voice/VoiceInterviewController";

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const BAR_DELAYS = ["-0.9s", "-0.6s", "-0.3s", "-0.75s", "-0.45s"];

function glyphFor(state: VoiceLoopState): ReactNode {
  const className = "h-7 w-7";
  switch (state) {
    case "speaking":
      return <Volume2 aria-hidden="true" className={className} />;
    case "listening":
    case "hearing":
      return <Mic aria-hidden="true" className={className} />;
    case "silence_countdown":
      return <Send aria-hidden="true" className={className} />;
    case "submitting":
      return <Loader aria-hidden="true" className={`${className} animate-spin`} />;
    case "paused":
      return <Pause aria-hidden="true" className={className} />;
    case "error":
      return <Info aria-hidden="true" className={className} />;
    default:
      return <Mic aria-hidden="true" className={`${className} opacity-70`} />;
  }
}

function haloFor(state: VoiceLoopState): string {
  switch (state) {
    case "speaking":
      return "bg-accent/45 opacity-90";
    case "hearing":
      return "bg-accent-3/40 opacity-90";
    case "silence_countdown":
      return "bg-accent-2/40 opacity-80";
    case "submitting":
      return "bg-accent-3/30 opacity-80";
    case "listening":
      return "bg-accent/30 opacity-70";
    case "error":
      return "bg-warning/30 opacity-80";
    case "paused":
      return "bg-surface-strong opacity-80";
    default:
      return "bg-accent/20 opacity-60";
  }
}

export interface VoiceOrbProps {
  state: VoiceLoopState;
  /** Normalised 0..1 microphone level; drives the amplitude response. */
  level: number;
  countdownRemainingMs: number | null;
  countdownTotalMs: number;
}

/**
 * State-reactive voice orb: CSS-only pulse while the interviewer speaks,
 * amplitude-driven scale while the user speaks, a calm breathing idle and a
 * rotating arc while thinking. Animations honour `prefers-reduced-motion`
 * through the global rule in `globals.css`.
 */
export function VoiceOrb({
  state,
  level,
  countdownRemainingMs,
  countdownTotalMs,
}: VoiceOrbProps) {
  const hearing = state === "hearing";
  const showBars = state === "speaking" || hearing;
  const coreAnimation =
    state === "speaking"
      ? "voice-orb-speak"
      : state === "listening" || state === "silence_countdown"
        ? "voice-orb-breathe"
        : "";
  const clampedLevel = Math.max(0, Math.min(1, level));
  const scale = hearing ? 1 + clampedLevel * 0.55 : 1;
  const countdownFraction =
    countdownRemainingMs !== null && countdownTotalMs > 0
      ? Math.max(0, Math.min(1, countdownRemainingMs / countdownTotalMs))
      : 0;

  return (
    <div className="relative grid h-40 w-40 place-items-center sm:h-44 sm:w-44" aria-hidden="true">
      <span
        className={`absolute inset-4 rounded-full blur-3xl transition-opacity duration-500 ${haloFor(state)}`}
      />

      {state === "silence_countdown" && countdownRemainingMs !== null && (
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 160 160"
          focusable="false"
        >
          <circle
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-border"
          />
          <circle
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-accent"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - countdownFraction)}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
      )}

      {state === "submitting" && (
        <span className="voice-orb-spin absolute inset-0 rounded-full border-2 border-transparent border-t-accent-3 border-r-accent/40" />
      )}

      <span
        className={`relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-white shadow-[0_20px_60px_-20px_var(--glow)] ${coreAnimation}`}
        style={
          hearing
            ? { transform: `scale(${scale})`, transition: "transform 90ms linear" }
            : undefined
        }
      >
        {glyphFor(state)}
      </span>

      {showBars && (
        <div className="absolute bottom-0 flex h-4 items-end gap-1">
          {BAR_DELAYS.map((delay) => (
            <span
              key={delay}
              className="voice-bar h-4 w-1 rounded-full bg-accent-3/80"
              style={{
                animationDelay: delay,
                opacity: hearing ? 0.4 + clampedLevel * 0.6 : 0.85,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
