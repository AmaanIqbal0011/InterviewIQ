"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Info,
  Mic,
  MicOff,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Send,
  SkipForward,
  Type,
  Volume2,
} from "lucide-react";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { VoiceSettingsPopover } from "@/components/voice/VoiceSettingsPopover";
import {
  countWords,
  isListeningState,
} from "@/lib/voice/VoiceInterviewController";
import type {
  VoiceLoopSnapshot,
  VoiceLoopState,
} from "@/lib/voice/VoiceInterviewController";
import type { VoiceLoopActions } from "@/lib/voice/useVoiceInterviewLoop";
import type { VoiceSettings } from "@/lib/voice/voiceSettings";

export interface VoiceHistoryItem {
  id: string;
  text: string;
  isUser: boolean;
  isQuestion?: boolean;
  isFollowup?: boolean;
  isFallback?: boolean;
  isNotice?: boolean;
}

export interface VoiceStageProps {
  questionText: string;
  /** Seconds left on the clock; the stage shows it as a live countdown. */
  remainingSeconds: number;
  history: VoiceHistoryItem[];
  snapshot: VoiceLoopSnapshot;
  settings: VoiceSettings;
  onSettingsChange: (patch: Partial<VoiceSettings>) => void;
  actions: VoiceLoopActions;
  /** Disabled while a modal dialog (e.g. End interview) is open. */
  shortcutsActive: boolean;
  onExit: () => void;
}

const ERROR_TITLES: Record<NonNullable<VoiceLoopSnapshot["errorReason"]>, string> = {
  mic_permission: "Microphone access needed",
  mic_not_found: "No microphone found",
  stt_unsupported: "Voice input isn't available here",
  recognition_stopped: "Voice recognition stopped",
  network: "We couldn't send your answer",
  unknown: "Voice input hit a problem",
};

const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 px-5 text-xs font-semibold text-white shadow-[0_12px_32px_-14px_var(--glow)] transition-all hover:brightness-110 focus-visible:brightness-110 disabled:pointer-events-none disabled:opacity-50";

const secondaryButton =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-xs font-medium text-foreground backdrop-blur-xl transition-all hover:border-accent/40 hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-50";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function statusText(snapshot: VoiceLoopSnapshot): ReactNode {
  switch (snapshot.state as VoiceLoopState) {
    case "idle":
      return snapshot.enabled ? "Getting voice ready…" : "Voice mode is off";
    case "speaking":
      return "Interviewer is speaking";
    case "listening":
      if (snapshot.capturePending) return "Waiting for the microphone…";
      if (snapshot.micMuted) return "Mic is muted";
      return "Your turn — I'm listening";
    case "hearing":
      return "Listening…";
    case "silence_countdown": {
      const seconds = Math.max(0, Math.ceil((snapshot.countdownRemainingMs ?? 0) / 1000));
      return (
        <>
          <span>Sending your answer in </span>
          <span aria-hidden="true" className="font-semibold tabular-nums">
            {seconds}…
          </span>
        </>
      );
    }
    case "submitting":
      return "Thinking…";
    case "paused":
      return "Paused";
    case "error":
      return "Voice input needs attention";
  }
}

function statusDot(snapshot: VoiceLoopSnapshot): string {
  switch (snapshot.state) {
    case "speaking":
    case "hearing":
      return "bg-accent";
    case "silence_countdown":
      return "bg-accent-2";
    case "submitting":
      return "bg-accent-3";
    case "listening":
      return snapshot.micMuted ? "bg-muted-foreground" : "bg-success";
    case "error":
      return "bg-warning";
    case "paused":
      return "bg-muted-foreground";
    default:
      return "bg-muted-foreground";
  }
}

function renderTranscript(snapshot: VoiceLoopSnapshot): ReactNode {
  const finalText = snapshot.finalTranscript.trim();
  const interimText = snapshot.interimTranscript.trim();
  if (finalText === "" && interimText === "") {
    return (
      <span className="text-sm text-muted-foreground">
        Speak your answer — it appears here live.
      </span>
    );
  }
  return (
    <>
      {finalText !== "" && <span className="text-sm text-foreground">{finalText}</span>}
      {interimText !== "" && (
        <span className="text-sm italic text-muted-foreground">
          {finalText !== "" ? " " : ""}
          {interimText}
          <span className="voice-caret ml-0.5 not-italic text-accent">▍</span>
        </span>
      )}
    </>
  );
}

/**
 * Full-screen hands-free voice interview stage: centered question + reactive
 * orb, live transcript, countdown ring with Send now / Keep talking, manual
 * controls, settings popover, keyboard shortcuts and polished error/empty
 * states. The state machine lives in `VoiceInterviewController`; this file is
 * presentation plus input wiring only.
 */
export function VoiceStage({
  questionText,
  remainingSeconds,
  history,
  snapshot,
  settings,
  onSettingsChange,
  actions,
  shortcutsActive,
  onExit,
}: VoiceStageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const state = snapshot.state;
  const listening = isListeningState(state);
  const canSend = listening && snapshot.transcript.trim() !== "";
  const wordCount = countWords(snapshot.transcript);

  useEffect(() => {
    if (!shortcutsActive) return;
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isFormField =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable === true;
      const isButtonLike = tagName === "BUTTON" || tagName === "SUMMARY";

      if (event.key === "Escape") {
        event.preventDefault();
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        onExit();
        return;
      }
      if (settingsOpen || isFormField || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " " || event.key === "Spacebar") {
        if (isButtonLike) return; // let the focused control activate natively
        event.preventDefault();
        if (state === "paused") actions.resume();
        else actions.pause();
        return;
      }
      if (event.key === "Enter") {
        if (isButtonLike) return;
        event.preventDefault();
        actions.sendNow();
        return;
      }
      if (event.key === "m" || event.key === "M") actions.toggleMute();
      else if (event.key === "r" || event.key === "R") actions.replay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutsActive, settingsOpen, state, actions, onExit]);

  return (
    <section
      aria-label="Voice interview"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      {/* Status + session timer */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-surface-strong px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${statusDot(snapshot)}`} />
          <span className="truncate">{statusText(snapshot)}</span>
        </p>
        <span
          className={`shrink-0 text-xs font-semibold tabular-nums ${
            remainingSeconds <= 45 ? "text-warning" : "text-muted-foreground"
          }`}
          aria-label={`${formatClock(remainingSeconds)} remaining`}
        >
          {formatClock(remainingSeconds)} left
        </span>
      </div>

      {/* Center: question, orb, transcript, history */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto overscroll-contain py-4">
        <h2
          key={questionText}
          className="voice-fade-in max-w-3xl text-balance text-center font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl lg:text-3xl"
        >
          {questionText}
        </h2>

        {state === "error" ? (
          <div
            role="alert"
            className="w-full max-w-2xl rounded-3xl border border-warning/40 bg-warning/10 p-6 text-center shadow-[0_20px_60px_-30px_var(--glow)]"
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
              <Info aria-hidden="true" className="h-6 w-6" />
            </span>
            <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
              {snapshot.errorReason ? ERROR_TITLES[snapshot.errorReason] : "Voice input problem"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {snapshot.errorMessage}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {snapshot.errorReason !== "stt_unsupported" && (
                <button type="button" onClick={actions.retry} className={primaryButton}>
                  Try again
                </button>
              )}
              <button type="button" onClick={onExit} className={secondaryButton}>
                <Type aria-hidden="true" className="h-4 w-4" />
                Switch to text mode
              </button>
            </div>
          </div>
        ) : (
          <>
            <VoiceOrb
              state={state}
              level={snapshot.micLevel}
              countdownRemainingMs={snapshot.countdownRemainingMs}
              countdownTotalMs={snapshot.countdownTotalMs}
            />

            {state === "silence_countdown" && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={actions.sendNow} disabled={!canSend} className={primaryButton}>
                  <Send aria-hidden="true" className="h-4 w-4" />
                  Send now
                </button>
                <span className="text-xs text-muted-foreground">
                  Keep talking and I&apos;ll wait — nothing sends while you speak.
                </span>
              </div>
            )}

            {state === "speaking" && (
              <button type="button" onClick={actions.skipAudio} className={secondaryButton}>
                <SkipForward aria-hidden="true" className="h-4 w-4" />
                Skip audio
              </button>
            )}

            {state === "submitting" && (
              <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-5 py-2.5">
                <span aria-hidden="true" className="voice-shimmer h-2 w-24 rounded-full" />
                <span className="text-xs text-muted-foreground">Preparing your next question…</span>
              </div>
            )}

            {state === "paused" && (
              <p className="text-sm text-muted-foreground">
                The loop is paused — your transcript is kept.
              </p>
            )}

            {/* Live transcript */}
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Your answer
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {wordCount} {wordCount === 1 ? "word" : "words"}
                </span>
              </div>
              <p
                aria-label="Your current transcript"
                className="mt-2 min-h-6 break-words leading-relaxed [overflow-wrap:anywhere]"
              >
                {renderTranscript(snapshot)}
              </p>
              {snapshot.transcript.trim() !== "" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  This is exactly what will be sent.
                </p>
              )}
            </div>

            {/* Previous turns */}
            {history.length > 0 && (
              <details className="w-full max-w-2xl rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <span>Previous answers ({history.filter((item) => item.isUser).length})</span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </summary>
                <ul className="max-h-56 space-y-3 overflow-y-auto border-t border-border px-4 py-3">
                  {history.map((item) => (
                    <li key={item.id} className="flex min-w-0 flex-col gap-1">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          item.isUser ? "text-accent-3" : "text-accent"
                        }`}
                      >
                        {item.isUser ? "You" : item.isNotice ? "Note" : "Interviewer"}
                      </span>
                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-border/80 pt-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {state === "speaking" && (
            <>
              <button type="button" onClick={actions.pause} className={secondaryButton}>
                <Pause aria-hidden="true" className="h-4 w-4" />
                Pause
              </button>
              <button type="button" onClick={actions.replay} className={secondaryButton}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Replay question
              </button>
            </>
          )}

          {listening && (
            <>
              <button type="button" onClick={actions.pause} className={secondaryButton}>
                <Pause aria-hidden="true" className="h-4 w-4" />
                Pause
              </button>
              <button
                type="button"
                aria-pressed={snapshot.micMuted}
                onClick={actions.toggleMute}
                className={secondaryButton}
              >
                {snapshot.micMuted ? (
                  <MicOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Mic aria-hidden="true" className="h-4 w-4" />
                )}
                {snapshot.micMuted ? "Unmute mic" : "Mute mic"}
              </button>
              <button type="button" onClick={actions.replay} className={secondaryButton}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Replay question
              </button>
              <button type="button" onClick={actions.redo} className={secondaryButton}>
                <Redo2 aria-hidden="true" className="h-4 w-4" />
                Redo answer
              </button>
              <button
                type="button"
                onClick={actions.sendNow}
                disabled={!canSend}
                className={primaryButton}
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                Send now
              </button>
            </>
          )}

          {state === "paused" && (
            <>
              <button type="button" onClick={actions.resume} className={primaryButton}>
                <Play aria-hidden="true" className="h-4 w-4" />
                Resume
              </button>
              <button type="button" onClick={actions.replay} className={secondaryButton}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Replay question
              </button>
            </>
          )}

          {state === "idle" && !snapshot.enabled && (
            <p className="px-2 text-xs text-muted-foreground">
              Turn Voice mode on to answer out loud.
            </p>
          )}

          <div className="ml-auto flex items-center gap-2">
            <VoiceSettingsPopover
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              settings={settings}
              onChange={onSettingsChange}
            />
            <button type="button" onClick={onExit} className={secondaryButton}>
              <Type aria-hidden="true" className="h-4 w-4" />
              Text mode
            </button>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Shortcuts: <kbd className="rounded border border-border px-1">Space</kbd> pause ·{" "}
          <kbd className="rounded border border-border px-1">Enter</kbd> send ·{" "}
          <kbd className="rounded border border-border px-1">M</kbd> mute ·{" "}
          <kbd className="rounded border border-border px-1">R</kbd> replay ·{" "}
          <kbd className="rounded border border-border px-1">Esc</kbd> text mode
        </p>
      </div>

      {snapshot.needsTapToStart && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-white shadow-[0_16px_40px_-16px_var(--glow)]">
              <Volume2 aria-hidden="true" className="h-7 w-7" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Tap to start voice
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your browser paused audio until you interact with the page. One tap unlocks the
              interviewer&apos;s voice and your microphone.
            </p>
            <button type="button" onClick={actions.tapToStart} className={primaryButton}>
              Tap to start
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
