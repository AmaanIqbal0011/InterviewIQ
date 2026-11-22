import {
  DURATION_MINUTES,
  WRAP_UP_SECONDS,
  type InterviewConfig,
  type InterviewDuration,
} from "@/lib/validation/interviewSchemas";

/** Where the interviewer is in the arc of a timed session. */
export const interviewPhases = ["OPENING", "MAIN", "WRAP_UP", "ENDED"] as const;
export type InterviewPhase = (typeof interviewPhases)[number];

export interface InterviewTimerOptions {
  /** Total session length in seconds (3, 5, 10 or 15 minutes). */
  readonly durationSeconds: number;
  /** Server-side start time; `null` while the session is still in `setup`. */
  readonly startedAt: string | Date | null;
  /** Injected clock so a request sees one consistent "now" (and tests stay deterministic). */
  readonly nowMs?: number;
  /** True once the interview row has been completed. */
  readonly completed?: boolean;
  /** True once the candidate has answered at least once (ends the opening). */
  readonly openingComplete?: boolean;
}

/**
 * Server-side clock for a timed interview.
 *
 * The timer never trusts the browser: it is always rebuilt from the row's
 * `started_at` plus the configured duration, so a refresh, a second tab or a
 * clock-skewed client can never extend the session.
 */
export class InterviewTimer {
  /** The interviewer stops opening new topics this long before the buzzer. */
  static readonly WRAP_UP_SECONDS = WRAP_UP_SECONDS;

  readonly durationSeconds: number;
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly completed: boolean;
  readonly openingComplete: boolean;

  constructor(options: InterviewTimerOptions) {
    const durationSeconds = Math.max(0, Math.trunc(options.durationSeconds));
    const startedAtMs = options.startedAt === null
      ? Date.now()
      : new Date(options.startedAt).getTime();

    this.durationSeconds = durationSeconds;
    this.startedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
    this.nowMs = options.nowMs ?? Date.now();
    this.completed = options.completed ?? false;
    this.openingComplete = options.openingComplete ?? false;
  }

  /** Total session length for a validated config, in seconds. */
  static durationSecondsFor(config: Pick<InterviewConfig, "duration_minutes">): number {
    return InterviewTimer.secondsFor(config.duration_minutes);
  }

  /** Total session length for one of the allowed durations, in seconds. */
  static secondsFor(duration: InterviewDuration): number {
    return DURATION_MINUTES[duration] * 60;
  }

  /** Whole seconds since `started_at`, never negative and never past the buzzer. */
  get elapsedSeconds(): number {
    return Math.max(0, Math.min(this.durationSeconds, this.totalElapsedSeconds));
  }

  /** Whole seconds left before the buzzer, floored at zero. */
  get remainingSeconds(): number {
    if (this.completed) return 0;
    return Math.max(0, this.durationSeconds - this.totalElapsedSeconds);
  }

  /** The current phase of the conversation. */
  get phase(): InterviewPhase {
    if (this.completed || this.remainingSeconds <= 0) return "ENDED";
    if (this.remainingSeconds <= InterviewTimer.WRAP_UP_SECONDS) return "WRAP_UP";
    if (!this.openingComplete) return "OPENING";
    return "MAIN";
  }

  /** True while the interviewer may still open a brand-new topic. */
  get canOpenNewTopic(): boolean {
    return this.phase === "OPENING" || this.phase === "MAIN";
  }

  /** True once the buzzer has sounded (time is up, even mid-conversation). */
  get isOutOfTime(): boolean {
    return !this.completed && this.remainingSeconds <= 0;
  }

  /** `m:ss` countdown, e.g. `0:45`. */
  formatRemaining(): string {
    const total = this.remainingSeconds;
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  /** Compact human phrasing for the system prompt. */
  describeTime(): string {
    const remaining = this.remainingSeconds;
    if (this.completed || remaining <= 0) return "the interview has ended";
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const parts: string[] = [];
    if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
    if (seconds > 0 || minutes === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
    return `${parts.join(" and ")} remaining`;
  }

  private get totalElapsedSeconds(): number {
    return Math.floor((this.nowMs - this.startedAtMs) / 1000);
  }
}
