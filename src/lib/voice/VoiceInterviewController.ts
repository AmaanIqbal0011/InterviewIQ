import { SilenceDetector } from "./SilenceDetector";
import { VoiceCaptureError } from "./types";
import type { VoiceLoopErrorReason } from "./types";
import { getRecognitionErrorReason } from "./WebSpeechRecognizer";
import { sanitizeSpeechText } from "./WebSpeechSynthesizer";
import { normalizeVoiceSettings } from "./voiceSettings";
import type { VoiceSettings } from "./voiceSettings";

/** How long we wait for TTS `onstart` before treating audio as blocked. */
export const TTS_START_TIMEOUT_MS = 2500;
/** Extra time granted beyond the estimated reading duration of a question. */
export const TTS_DURATION_GRACE_MS = 8000;
/** Estimated speaking time per character at rate 1. */
export const TTS_DURATION_PER_CHAR_MS = 80;
/** Silence window before the gentle "Still there?" nudge. */
export const NO_SPEECH_PROMPT_MS = 15000;
/** Bounded auto-restarts for an unexpected recognition stop. */
export const MAX_RECOGNITION_RESTARTS = 3;
/** Auto-send never fires for a transcript shorter than this many words. */
export const MIN_AUTO_SEND_WORDS = 2;
/** UI countdown ring refresh interval. */
export const COUNTDOWN_TICK_MS = 100;
/** Minimum gap between mic-level snapshot emissions (keeps renders ~33 Hz). */
export const MIC_LEVEL_EMIT_MS = 30;

export const NO_SPEECH_PROMPT_MESSAGE = "Still there? Take your time.";
export const TTS_WARNING_MESSAGE = "Audio couldn't play — the question is on screen.";

const ERROR_MESSAGES: Record<VoiceLoopErrorReason, string> = {
  mic_permission:
    "Microphone access is blocked. Open this site's permissions from the address bar, allow the microphone, then choose Try again.",
  mic_not_found:
    "We couldn't find a microphone. Connect one (or allow this device's mic) and choose Try again.",
  stt_unsupported:
    "This browser doesn't support voice input. Switch to text mode to keep answering.",
  recognition_stopped:
    "Voice recognition stopped unexpectedly. Choose Try again, or switch to text mode.",
  network: "We couldn't send your answer. Your transcript is kept — choose Retry to send it again.",
  unknown: "Voice input hit a problem. Choose Try again, or switch to text mode.",
};

export type VoiceLoopState =
  | "idle"
  | "speaking"
  | "listening"
  | "hearing"
  | "silence_countdown"
  | "submitting"
  | "paused"
  | "error";

const LISTENING_STATES: readonly VoiceLoopState[] = ["listening", "hearing", "silence_countdown"];

export function isListeningState(state: VoiceLoopState): boolean {
  return LISTENING_STATES.includes(state);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function joinTranscript(finalText: string, interimText: string): string {
  return [finalText.trim(), interimText.trim()].filter(Boolean).join(" ");
}

export interface VoiceLoopSnapshot {
  readonly enabled: boolean;
  readonly state: VoiceLoopState;
  /** Finalised recognition text accumulated for the current answer. */
  readonly finalTranscript: string;
  /** Recognition text still being finalised (shown dimmed in the UI). */
  readonly interimTranscript: string;
  /** `finalTranscript + interimTranscript`, what Send would submit. */
  readonly transcript: string;
  /** True while the microphone/recogniser pipeline is still opening. */
  readonly capturePending: boolean;
  readonly micMuted: boolean;
  /** Normalised 0..1 input level for the visualiser. */
  readonly micLevel: number;
  readonly countdownRemainingMs: number | null;
  readonly countdownTotalMs: number;
  readonly needsTapToStart: boolean;
  readonly errorReason: VoiceLoopErrorReason | null;
  readonly errorMessage: string | null;
  readonly notice: string | null;
}

/** Snapshot fields are readonly for consumers; patches are internal-only. */
type MutableSnapshotPatch = {
  -readonly [Key in keyof VoiceLoopSnapshot]?: VoiceLoopSnapshot[Key];
};

export const INITIAL_VOICE_SNAPSHOT: VoiceLoopSnapshot = {
  enabled: false,
  state: "idle",
  finalTranscript: "",
  interimTranscript: "",
  transcript: "",
  capturePending: false,
  micMuted: false,
  micLevel: 0,
  countdownRemainingMs: null,
  countdownTotalMs: 0,
  needsTapToStart: false,
  errorReason: null,
  errorMessage: null,
  notice: null,
};

export type SubmitOutcome =
  | { readonly status: "next"; readonly questionText: string }
  | { readonly status: "completed" }
  | { readonly status: "ignored" };

export interface VoiceSpeechHandlers {
  onStart(): void;
  onEnd(): void;
  onError(): void;
}

export interface VoiceCaptureCallbacks {
  onLevel(rms: number, nowMs: number): void;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onEnd(shouldRestart: boolean): void;
  onError(message: string, code?: string): void;
  onNotice(message: string): void;
}

/**
 * Browser-facing side effects the controller drives. Implemented by the React
 * hook (Web Speech + Web Audio), mocked in unit tests. The controller itself
 * never touches the DOM.
 */
export interface VoiceLoopEnvironment {
  /** Called synchronously inside the enabling user gesture to unlock audio. */
  primeAudio(): void;
  checkSupport(): { recognition: boolean; synthesis: boolean };
  startSpeech(text: string, handlers: VoiceSpeechHandlers): void;
  cancelSpeech(): void;
  setRate(rate: number): void;
  startCapture(callbacks: VoiceCaptureCallbacks): Promise<void>;
  /** Idempotent; also cancels a capture that is still opening. */
  stopCapture(): void;
  /** Restarts recognition after an unexpected `end`. Throws on failure. */
  restartRecognition(): void;
  /** The single submission path shared with the manual Send button. */
  submit(text: string): Promise<SubmitOutcome>;
}

export type VoiceLoopEvent =
  | { readonly type: "enable"; readonly question?: string; readonly seedTranscript?: string }
  | { readonly type: "disable" }
  | { readonly type: "question"; readonly text: string }
  | { readonly type: "tts_started" }
  | { readonly type: "tts_ended" }
  | { readonly type: "tts_failed" }
  | { readonly type: "level"; readonly rms: number; readonly nowMs: number }
  | { readonly type: "transcript"; readonly text: string; readonly final: boolean }
  | { readonly type: "recognition_ended"; readonly shouldRestart: boolean }
  | { readonly type: "recognition_error"; readonly message: string; readonly code?: string }
  | { readonly type: "notice"; readonly message: string }
  | { readonly type: "capture_opened"; readonly requestId: number }
  | { readonly type: "capture_failed"; readonly requestId: number; readonly error: unknown }
  | { readonly type: "submit_resolved"; readonly requestId: number; readonly outcome: SubmitOutcome }
  | { readonly type: "submit_failed"; readonly requestId: number; readonly message: string }
  | { readonly type: "pause" }
  | { readonly type: "resume" }
  | { readonly type: "toggle_mute" }
  | { readonly type: "skip_audio" }
  | { readonly type: "replay" }
  | { readonly type: "redo" }
  | { readonly type: "send_now" }
  | { readonly type: "retry" }
  | { readonly type: "tap_to_start" };

type PauseOrigin = "speaking" | "silence_countdown" | "listening";

/**
 * Hands-free voice interview state machine.
 *
 * ```
 * idle → speaking → listening → hearing ⇄ silence_countdown → submitting ─┐
 *            ↑                     │                │            │        │
 *            └─────────────────────┴── paused ──────┘            │        │
 *                                    error(typed) ←──────────────┘        │
 *                     idle(disabled) ←────────────────────────────────────┘
 * ```
 *
 * All side effects (speech, microphone, submission) go through the injected
 * {@link VoiceLoopEnvironment}; every transition happens inside `dispatch`.
 */
export class VoiceInterviewController {
  private state: VoiceLoopState = "idle";
  private snapshot: VoiceLoopSnapshot = { ...INITIAL_VOICE_SNAPSHOT };
  private readonly listeners = new Set<() => void>();
  private readonly detector = new SilenceDetector();
  private settings: VoiceSettings;

  private currentQuestion = "";
  private pendingSpeakText = "";
  private speakToken = 0;
  private audioStartedOnce = false;
  private tapOffered = false;

  private finalTranscript = "";
  private interimTranscript = "";
  private heardSpeech = false;
  private promptShown = false;

  private captureActive = false;
  private captureAwaiting = false;
  private captureCancelled = false;
  private captureRequestId = 0;
  private restartCount = 0;
  private micMuted = false;

  private countdownDeadlineMs: number | null = null;
  private pausedCountdownRemainingMs: number | null = null;
  private pauseOrigin: PauseOrigin = "listening";

  private submissionSeq = 0;
  private activeSubmission: number | null = null;
  private lastAttemptText: string | null = null;

  private ttsStartTimer: ReturnType<typeof setTimeout> | null = null;
  private ttsDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private promptTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTick: ReturnType<typeof setInterval> | null = null;
  private lastLevelEmitMs = 0;
  private disposed = false;

  constructor(
    private readonly env: VoiceLoopEnvironment,
    settings: VoiceSettings,
  ) {
    this.settings = normalizeVoiceSettings(settings);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): VoiceLoopSnapshot => this.snapshot;

  get stateName(): VoiceLoopState {
    return this.state;
  }

  dispatch(event: VoiceLoopEvent): void {
    if (this.disposed) return;
    switch (event.type) {
      case "enable":
        this.onEnable(event.question, event.seedTranscript);
        break;
      case "disable":
        this.onDisable();
        break;
      case "question":
        this.onQuestion(event.text);
        break;
      case "tts_started":
        this.onTtsStarted();
        break;
      case "tts_ended":
        this.onTtsEnded();
        break;
      case "tts_failed":
        this.handleTtsUnavailable();
        break;
      case "level":
        this.onLevel(event.rms, event.nowMs);
        break;
      case "transcript":
        this.onTranscript(event.text, event.final);
        break;
      case "recognition_ended":
        this.onRecognitionEnded(event.shouldRestart);
        break;
      case "recognition_error":
        this.onRecognitionError(event.message, event.code);
        break;
      case "notice":
        this.patch({ notice: event.message });
        break;
      case "capture_opened":
        this.onCaptureOpened(event.requestId);
        break;
      case "capture_failed":
        this.onCaptureFailed(event.requestId, event.error);
        break;
      case "submit_resolved":
        this.onSubmitResolved(event.requestId, event.outcome);
        break;
      case "submit_failed":
        this.onSubmitFailed(event.requestId, event.message);
        break;
      case "pause":
        this.onPause();
        break;
      case "resume":
        this.onResume();
        break;
      case "toggle_mute":
        this.onToggleMute();
        break;
      case "skip_audio":
        this.onSkipAudio();
        break;
      case "replay":
        this.onReplay();
        break;
      case "redo":
        this.onRedo();
        break;
      case "send_now":
        this.onSendNow();
        break;
      case "retry":
        this.onRetry();
        break;
      case "tap_to_start":
        this.onTapToStart();
        break;
    }
  }

  /** Stops every timer, closes the microphone and drops pending work. */
  disable(): void {
    if (this.disposed) return;
    this.onDisable();
  }

  /** Terminal teardown for tests/unmount; the instance cannot be reused. */
  dispose(): void {
    if (this.disposed) return;
    this.onDisable();
    this.disposed = true;
    this.listeners.clear();
  }

  updateSettings(patch: Partial<VoiceSettings>): void {
    if (this.disposed) return;
    this.settings = normalizeVoiceSettings({ ...this.settings, ...patch });
    this.env.setRate(this.settings.voiceRate);
    // A running countdown keeps its original deadline; the new delay applies
    // from the next speech pause. Turning auto-send off drops back to manual.
    if (this.state === "silence_countdown" && !this.settings.autoSend) {
      this.setState("listening");
    }
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  // ---------------------------------------------------------------- enable

  private onEnable(question?: string, seedTranscript?: string): void {
    const support = this.env.checkSupport();
    if (question !== undefined) this.currentQuestion = question;
    this.env.primeAudio();
    this.env.setRate(this.settings.voiceRate);

    const alreadyEnabled = this.snapshot.enabled && this.state !== "idle";
    this.resetAnswerCycle(seedTranscript);
    this.micMuted = false;
    this.audioStartedOnce = false;
    this.tapOffered = false;
    this.patch({ enabled: true, micMuted: false, micLevel: 0 });

    if (!support.recognition) {
      this.fail("stt_unsupported", ERROR_MESSAGES.stt_unsupported);
      return;
    }

    if (alreadyEnabled) {
      // Re-enabling with a question (e.g. programmatic) replays it.
      if (this.currentQuestion.trim() !== "") this.startSpeaking(this.currentQuestion);
      return;
    }

    if (this.currentQuestion.trim() !== "") {
      this.startSpeaking(this.currentQuestion);
    } else {
      this.setState("idle");
    }
  }

  private onDisable(): void {
    this.speakToken += 1;
    this.env.cancelSpeech();
    this.clearAllTimers();
    this.activeSubmission = null;
    this.lastAttemptText = null;
    this.captureActive = false;
    this.micMuted = false;
    this.currentQuestion = "";
    this.resetAnswerCycle();
    this.state = "idle";
    this.env.stopCapture();
    this.syncCapture();
    this.patch({
      ...INITIAL_VOICE_SNAPSHOT,
      state: "idle",
      capturePending: false,
    });
  }

  private onQuestion(text: string): void {
    this.currentQuestion = text;
    if (!this.snapshot.enabled) return;
    this.resetAnswerCycle();
    this.startSpeaking(text);
  }

  // --------------------------------------------------------------- speaking

  private startSpeaking(text: string): void {
    if (!this.snapshot.enabled) return;
    this.clearAllTimers();
    this.pendingSpeakText = sanitizeSpeechText(text);

    if (this.pendingSpeakText === "" || !this.env.checkSupport().synthesis) {
      if (this.pendingSpeakText !== "") {
        this.setState("listening", { notice: TTS_WARNING_MESSAGE });
        return;
      }
      this.beginListening();
      return;
    }

    this.setState("speaking");
    this.attemptSpeak();
  }

  private attemptSpeak(): void {
    const text = this.pendingSpeakText;
    if (text === "") {
      this.beginListening();
      return;
    }
    this.clearTtsTimers();
    this.speakToken += 1;
    const token = this.speakToken;
    // Arm the watchdog before speaking so even a synchronous `onStart` from
    // the environment lands on an already-armed (and then cleared) timer.
    this.ttsStartTimer = setTimeout(() => {
      if (token !== this.speakToken || this.state !== "speaking") return;
      this.onTtsStartTimeout();
    }, TTS_START_TIMEOUT_MS);
    this.env.cancelSpeech();
    this.env.startSpeech(text, {
      onStart: () => {
        if (token !== this.speakToken || this.state !== "speaking") return;
        this.dispatch({ type: "tts_started" });
      },
      onEnd: () => {
        if (token !== this.speakToken) return;
        this.dispatch({ type: "tts_ended" });
      },
      onError: () => {
        if (token !== this.speakToken) return;
        this.dispatch({ type: "tts_failed" });
      },
    });
  }

  private onTtsStartTimeout(): void {
    // First silence after enabling looks like a blocked autoplay gesture:
    // ask for one explicit tap. A second failure means audio is unavailable.
    if (!this.audioStartedOnce && !this.tapOffered) {
      this.tapOffered = true;
      this.patch({ needsTapToStart: true });
      return;
    }
    this.handleTtsUnavailable();
  }

  private onTtsStarted(): void {
    if (this.state !== "speaking") return;
    this.audioStartedOnce = true;
    this.clearTtsStartTimer();
    this.patch({ needsTapToStart: false });
    const estimatedMs =
      (this.pendingSpeakText.length * TTS_DURATION_PER_CHAR_MS) / this.settings.voiceRate +
      TTS_DURATION_GRACE_MS;
    const token = this.speakToken;
    this.ttsDurationTimer = setTimeout(() => {
      if (token !== this.speakToken || this.state !== "speaking") return;
      // `onend` was never delivered (common on iOS after backgrounding):
      // continue the loop instead of hanging on the question.
      this.onTtsEnded();
    }, estimatedMs);
  }

  private onTtsEnded(): void {
    if (this.state !== "speaking") return;
    this.clearTtsTimers();
    this.beginListening();
  }

  private handleTtsUnavailable(): void {
    if (this.state !== "speaking") return;
    this.clearTtsTimers();
    this.setState("listening", { notice: TTS_WARNING_MESSAGE });
  }

  private onTapToStart(): void {
    if (this.state !== "speaking" || !this.snapshot.needsTapToStart) return;
    this.env.primeAudio();
    this.patch({ needsTapToStart: false });
    this.attemptSpeak();
  }

  private onSkipAudio(): void {
    if (this.state !== "speaking") return;
    this.speakToken += 1;
    this.env.cancelSpeech();
    this.clearTtsTimers();
    this.beginListening();
  }

  private onReplay(): void {
    if (!this.snapshot.enabled) return;
    if (this.state === "submitting" || this.state === "paused" || this.state === "error") return;
    if (this.currentQuestion.trim() === "") return;
    this.startSpeaking(this.currentQuestion);
  }

  // -------------------------------------------------------------- listening

  private beginListening(): void {
    if (!this.snapshot.enabled) return;
    if (this.state === "submitting") return;
    this.setState("listening");
  }

  private onCaptureOpened(requestId: number): void {
    if (requestId !== this.captureRequestId) return;
    this.captureAwaiting = false;
    this.captureCancelled = false;
    if (!this.isCaptureDesired()) {
      this.env.stopCapture();
      this.patch({ capturePending: false });
      return;
    }
    this.captureActive = true;
    this.restartCount = 0;
    this.promptShown = false;
    this.detector.reset(Date.now());
    this.lastLevelEmitMs = 0;
    this.armNoSpeechPrompt();
    this.patch({ capturePending: false });
  }

  private onCaptureFailed(requestId: number, error: unknown): void {
    if (requestId !== this.captureRequestId) return;
    this.captureAwaiting = false;
    if (this.captureCancelled) {
      // We closed the pipeline ourselves (disable/pause/mode switch): if the
      // loop wants the mic again, restart cleanly instead of erroring out.
      this.captureCancelled = false;
      this.patch({ capturePending: false });
      if (this.isCaptureDesired()) this.beginCapture();
      return;
    }
    this.patch({ capturePending: false });
    if (!this.isCaptureDesired()) return;
    const reason: VoiceLoopErrorReason =
      error instanceof VoiceCaptureError ? error.reason : "unknown";
    const message =
      error instanceof VoiceCaptureError && error.message !== ""
        ? error.message
        : ERROR_MESSAGES[reason];
    this.fail(reason, message);
  }

  private isCaptureDesired(): boolean {
    return (
      this.snapshot.enabled && !this.micMuted && isListeningState(this.state)
    );
  }

  private syncCapture(): void {
    const desired = this.isCaptureDesired();
    if (desired) {
      if (!this.captureActive && !this.captureAwaiting) this.beginCapture();
      return;
    }
    if (this.captureActive) {
      this.captureActive = false;
      this.env.stopCapture();
    }
    if (this.captureAwaiting) this.captureCancelled = true;
    this.clearNoSpeechPrompt();
    this.patch({ capturePending: false, micLevel: 0 });
  }

  private beginCapture(): void {
    this.captureRequestId += 1;
    const requestId = this.captureRequestId;
    this.captureAwaiting = true;
    this.patch({ capturePending: true });
    const callbacks: VoiceCaptureCallbacks = {
      onLevel: (rms, nowMs) => this.dispatch({ type: "level", rms, nowMs }),
      onInterim: (text) => this.dispatch({ type: "transcript", text, final: false }),
      onFinal: (text) => this.dispatch({ type: "transcript", text, final: true }),
      onEnd: (shouldRestart) =>
        this.dispatch({ type: "recognition_ended", shouldRestart: shouldRestart ?? true }),
      onError: (message, code) => this.dispatch({ type: "recognition_error", message, code }),
      onNotice: (message) => this.dispatch({ type: "notice", message }),
    };
    try {
      this.env.startCapture(callbacks).then(
        () => this.dispatch({ type: "capture_opened", requestId }),
        (error: unknown) => this.dispatch({ type: "capture_failed", requestId, error }),
      );
    } catch (error) {
      this.dispatch({ type: "capture_failed", requestId, error });
    }
  }

  private onLevel(rms: number, nowMs: number): void {
    if (!this.captureActive || !isListeningState(this.state)) return;
    const event = this.detector.observe(rms, nowMs);
    if (nowMs - this.lastLevelEmitMs >= MIC_LEVEL_EMIT_MS) {
      this.lastLevelEmitMs = nowMs;
      this.patch({ micLevel: Math.min(1, rms * 6) });
    }
    if (!event) return;
    if (event.type === "speech_started") this.onSpeechStarted();
    else if (event.type === "speech_ended") this.onSpeechEnded(event.qualified);
  }

  private onSpeechStarted(): void {
    if (!isListeningState(this.state)) return;
    // Any new speech cancels the quiet-period prompt and, if we were counting
    // down to auto-send, sends us straight back to hearing.
    this.clearNoSpeechPrompt();
    this.setState("hearing");
  }

  private onSpeechEnded(qualified: boolean): void {
    if (!isListeningState(this.state)) return;
    if (qualified) this.heardSpeech = true;
    const hasText = this.getTranscript() !== "";
    if (this.settings.autoSend && (qualified || hasText)) {
      this.startCountdown(this.settings.silenceDelayMs);
    } else {
      this.setState("listening");
      if (!qualified && this.captureActive) this.armNoSpeechPrompt();
    }
  }

  private onTranscript(text: string, final: boolean): void {
    if (!this.snapshot.enabled || !isListeningState(this.state)) return;
    if (final) {
      const merged = [this.finalTranscript.trim(), text.trim()].filter(Boolean).join(" ");
      this.applyTranscript(merged, "");
      return;
    }
    this.applyTranscript(this.finalTranscript, text);
  }

  private applyTranscript(finalText: string, interimText: string): void {
    this.finalTranscript = finalText;
    this.interimTranscript = interimText;
    this.patch({
      finalTranscript: finalText,
      interimTranscript: interimText,
      transcript: joinTranscript(finalText, interimText),
    });
  }

  private getTranscript(): string {
    return joinTranscript(this.finalTranscript, this.interimTranscript);
  }

  private resetAnswerCycle(seedTranscript?: string): void {
    this.applyTranscript(seedTranscript ?? "", "");
    this.heardSpeech = false;
    this.promptShown = false;
    this.lastAttemptText = null;
  }

  private armNoSpeechPrompt(): void {
    this.clearNoSpeechPrompt();
    this.promptTimer = setTimeout(() => {
      this.promptTimer = null;
      if (this.state !== "listening") return;
      if (this.promptShown || this.heardSpeech || this.getTranscript() !== "") return;
      this.promptShown = true;
      this.patch({ notice: NO_SPEECH_PROMPT_MESSAGE });
    }, NO_SPEECH_PROMPT_MS);
  }

  private clearNoSpeechPrompt(): void {
    if (this.promptTimer !== null) {
      clearTimeout(this.promptTimer);
      this.promptTimer = null;
    }
  }

  // -------------------------------------------------------------- countdown

  private startCountdown(durationMs: number): void {
    this.countdownDeadlineMs = Date.now() + durationMs;
    this.setState("silence_countdown", {
      countdownRemainingMs: durationMs,
      countdownTotalMs: durationMs,
    });
    this.armCountdown();
  }

  private armCountdown(): void {
    const deadline = this.countdownDeadlineMs;
    if (deadline === null) return;
    this.clearCountdownHandles();
    const remaining = Math.max(0, deadline - Date.now());
    this.countdownTimer = setTimeout(() => this.onCountdownExpired(), remaining);
    this.countdownTick = setInterval(() => {
      const left = Math.max(0, (this.countdownDeadlineMs ?? Date.now()) - Date.now());
      this.patch({ countdownRemainingMs: left });
    }, COUNTDOWN_TICK_MS);
    this.patch({ countdownRemainingMs: remaining });
  }

  private onCountdownExpired(): void {
    if (this.state !== "silence_countdown") return;
    this.clearCountdownHandles();
    const text = this.getTranscript();
    if (countWords(text) < MIN_AUTO_SEND_WORDS) {
      // A cough or a single stray word never auto-sends: keep listening.
      this.setState("listening");
      return;
    }
    this.submitTranscript(text);
  }

  private onSendNow(): void {
    if (!isListeningState(this.state)) return;
    const text = this.getTranscript();
    if (text === "") return;
    this.submitTranscript(text);
  }

  private submitTranscript(text: string): void {
    if (!this.snapshot.enabled) return;
    if (!isListeningState(this.state)) return;
    this.beginSubmit(text);
  }

  private beginSubmit(text: string): void {
    if (this.activeSubmission !== null) return;
    const requestId = ++this.submissionSeq;
    this.activeSubmission = requestId;
    this.lastAttemptText = text;
    this.clearAllTimers();
    this.setState("submitting");
    try {
      this.env.submit(text).then(
        (outcome) => this.dispatch({ type: "submit_resolved", requestId, outcome }),
        (error: unknown) =>
          this.dispatch({
            type: "submit_failed",
            requestId,
            message: error instanceof Error && error.message !== "" ? error.message : "",
          }),
      );
    } catch (error) {
      this.dispatch({
        type: "submit_failed",
        requestId,
        message: error instanceof Error && error.message !== "" ? error.message : "",
      });
    }
  }

  private onSubmitResolved(requestId: number, outcome: SubmitOutcome): void {
    if (this.activeSubmission !== requestId) return;
    this.activeSubmission = null;
    if (!this.snapshot.enabled) return;
    switch (outcome.status) {
      case "next":
        this.lastAttemptText = null;
        this.onQuestion(outcome.questionText);
        break;
      case "completed":
        this.onDisable();
        break;
      case "ignored":
        this.setState("listening");
        break;
    }
  }

  private onSubmitFailed(requestId: number, message: string): void {
    if (this.activeSubmission !== requestId) return;
    this.activeSubmission = null;
    if (!this.snapshot.enabled) return;
    this.fail("network", message !== "" ? message : ERROR_MESSAGES.network);
  }

  // ------------------------------------------------------------------ errors

  private fail(reason: VoiceLoopErrorReason, message: string): void {
    this.clearAllTimers();
    this.setState("error", { errorReason: reason, errorMessage: message });
  }

  private onRecognitionEnded(shouldRestart: boolean): void {
    if (!this.captureActive || !isListeningState(this.state)) return;
    if (!shouldRestart || this.restartCount >= MAX_RECOGNITION_RESTARTS) {
      this.fail("recognition_stopped", ERROR_MESSAGES.recognition_stopped);
      return;
    }
    this.restartCount += 1;
    try {
      this.env.restartRecognition();
    } catch {
      this.fail("recognition_stopped", ERROR_MESSAGES.recognition_stopped);
    }
  }

  private onRecognitionError(message: string, code?: string): void {
    if (!this.captureActive || !isListeningState(this.state)) return;
    const reason = getRecognitionErrorReason(code);
    if (reason === null) {
      // Soft errors (`no-speech`, `aborted`, transient `network`, ...) are
      // absorbed; the bounded restart on `end` keeps the loop alive.
      if (code === "network") this.patch({ notice: message });
      return;
    }
    this.fail(reason, message !== "" ? message : ERROR_MESSAGES[reason]);
  }

  private onRetry(): void {
    if (this.state !== "error") return;
    const reason = this.snapshot.errorReason;
    if (reason === "network") {
      const text = this.lastAttemptText ?? this.getTranscript();
      if (text !== "") {
        this.beginSubmit(text);
        return;
      }
      this.recoverToListening();
      return;
    }
    if (reason === "stt_unsupported") return;
    this.recoverToListening();
  }

  private recoverToListening(): void {
    this.setState("listening");
  }

  // ------------------------------------------------------------ manual verbs

  private onPause(): void {
    if (!this.snapshot.enabled) return;
    if (
      this.state === "paused" ||
      this.state === "submitting" ||
      this.state === "error" ||
      this.state === "idle"
    ) {
      return;
    }
    if (this.state === "silence_countdown" && this.countdownDeadlineMs !== null) {
      this.pausedCountdownRemainingMs = Math.max(0, this.countdownDeadlineMs - Date.now());
      this.pauseOrigin = "silence_countdown";
    } else if (this.state === "speaking") {
      this.pausedCountdownRemainingMs = null;
      this.pauseOrigin = "speaking";
      this.speakToken += 1;
      this.env.cancelSpeech();
      this.clearTtsTimers();
    } else {
      this.pausedCountdownRemainingMs = null;
      this.pauseOrigin = "listening";
    }
    this.setState("paused");
  }

  private onResume(): void {
    if (this.state !== "paused") return;
    if (this.pauseOrigin === "speaking") {
      this.startSpeaking(this.currentQuestion);
      return;
    }
    if (
      this.pauseOrigin === "silence_countdown" &&
      this.settings.autoSend &&
      this.pausedCountdownRemainingMs !== null &&
      this.getTranscript() !== ""
    ) {
      const remaining = this.pausedCountdownRemainingMs;
      this.pausedCountdownRemainingMs = null;
      this.startCountdown(Math.max(COUNTDOWN_TICK_MS, remaining));
      return;
    }
    this.pausedCountdownRemainingMs = null;
    this.setState("listening");
  }

  private onToggleMute(): void {
    if (!this.snapshot.enabled) return;
    this.micMuted = !this.micMuted;
    if (this.micMuted && this.state !== "listening" && isListeningState(this.state)) {
      this.setState("listening");
    }
    this.patch({ micMuted: this.micMuted });
    this.syncCapture();
  }

  private onRedo(): void {
    if (!this.snapshot.enabled) return;
    if (this.state === "submitting" || this.state === "paused") return;
    if (this.state === "error" && this.snapshot.errorReason === "stt_unsupported") return;
    this.clearAllTimers();
    this.resetAnswerCycle();
    this.setState("listening");
    if (this.captureActive) this.armNoSpeechPrompt();
  }

  // ------------------------------------------------------------------ helper

  private setState(next: VoiceLoopState, extra?: Partial<VoiceLoopSnapshot>): void {
    const previous = this.state;
    this.state = next;
    const body: MutableSnapshotPatch = { ...extra, state: next };
    if (previous !== next) {
      // Notices (gentle prompts, soft warnings) survive quiet transitions
      // like pause/resume and are cleared by meaningful ones (new question,
      // speech, submission, error) unless the transition supplies a new one.
      if (
        extra?.notice !== undefined ||
        next === "speaking" ||
        next === "hearing" ||
        next === "submitting" ||
        next === "error" ||
        next === "idle"
      ) {
        body.notice = extra?.notice ?? null;
      }
      if (next !== "silence_countdown") {
        body.countdownRemainingMs = extra?.countdownRemainingMs ?? null;
        this.clearCountdownState();
      }
      if (next !== "error") {
        body.errorReason = extra?.errorReason ?? null;
        body.errorMessage = extra?.errorMessage ?? null;
      }
      if (next !== "speaking") body.needsTapToStart = extra?.needsTapToStart ?? false;
    }
    this.patch(body);
    if (previous === next) return;
    if (previous === "speaking") {
      // Invalidate speech callbacks so late `onend`/`onerror` from the
      // cancelled utterance cannot drive the loop.
      this.speakToken += 1;
      this.clearTtsTimers();
    }
    if (isListeningState(previous) && !isListeningState(next)) {
      this.clearNoSpeechPrompt();
    }
    this.syncCapture();
  }

  private patch(partial: Partial<VoiceLoopSnapshot>): void {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof VoiceLoopSnapshot)[]) {
      if (this.snapshot[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private clearTtsStartTimer(): void {
    if (this.ttsStartTimer !== null) {
      clearTimeout(this.ttsStartTimer);
      this.ttsStartTimer = null;
    }
  }

  private clearTtsTimers(): void {
    this.clearTtsStartTimer();
    if (this.ttsDurationTimer !== null) {
      clearTimeout(this.ttsDurationTimer);
      this.ttsDurationTimer = null;
    }
  }

  private clearCountdownHandles(): void {
    if (this.countdownTimer !== null) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownTick !== null) {
      clearInterval(this.countdownTick);
      this.countdownTick = null;
    }
  }

  private clearCountdownState(): void {
    this.clearCountdownHandles();
    this.countdownDeadlineMs = null;
  }

  private clearAllTimers(): void {
    this.clearTtsTimers();
    this.clearCountdownState();
    this.clearNoSpeechPrompt();
  }
}
