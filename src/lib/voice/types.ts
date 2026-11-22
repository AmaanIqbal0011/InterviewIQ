/**
 * Shared voice-loop contracts.
 *
 * Kept DOM-free (aside from the Web Speech structural types below) so the
 * state machine in `VoiceInterviewController` can be unit tested in Node.
 */

/** Terminal reasons the hands-free loop can fail in. */
export type VoiceLoopErrorReason =
  | "mic_permission"
  | "mic_not_found"
  | "stt_unsupported"
  | "recognition_stopped"
  | "network"
  | "unknown";

/** Failures raised while opening the microphone/capture pipeline. */
export type VoiceCaptureErrorReason = Exclude<VoiceLoopErrorReason, "network">;

/**
 * Error thrown by capture setup (mic permission, missing device, ...).
 * Carries a typed `reason` plus an optional user-safe message.
 */
export class VoiceCaptureError extends Error {
  readonly reason: VoiceCaptureErrorReason;

  constructor(reason: VoiceCaptureErrorReason, message?: string) {
    super(message ?? "");
    this.name = "VoiceCaptureError";
    this.reason = reason;
  }
}

export interface SpeechRecognizer {
  onInterimResult: ((text: string) => void) | null;
  onFinalResult: ((text: string) => void) | null;
  /** `code` is the raw SpeechRecognition error code (e.g. "not-allowed"). */
  onError: ((message: string, code?: string) => void) | null;
  onNotice: ((message: string) => void) | null;
  onEnd: ((shouldRestart?: boolean) => void) | null;
  start(): void;
  /** Stops recognition gracefully (results may still flush). */
  stop(): void;
  /** Stops recognition immediately and drops pending results. */
  abort(): void;
}

export interface SpeechSynthesizer {
  onStart: (() => void) | null;
  onEnd: (() => void) | null;
  onError: (() => void) | null;
  onBoundary: ((charIndex: number) => void) | null;
  speak(text: string): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  setRate(rate: number): void;
}

export interface SpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
