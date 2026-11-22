import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RECOGNITION_RESTARTS,
  MIN_AUTO_SEND_WORDS,
  NO_SPEECH_PROMPT_MS,
  NO_SPEECH_PROMPT_MESSAGE,
  TTS_START_TIMEOUT_MS,
  TTS_WARNING_MESSAGE,
  VoiceInterviewController,
  countWords,
  isListeningState,
} from "@/lib/voice/VoiceInterviewController";
import type {
  SubmitOutcome,
  VoiceCaptureCallbacks,
  VoiceLoopEnvironment,
  VoiceLoopSnapshot,
  VoiceLoopState,
  VoiceSpeechHandlers,
} from "@/lib/voice/VoiceInterviewController";
import { VoiceCaptureError } from "@/lib/voice/types";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/voice/voiceSettings";
import type { VoiceSettings } from "@/lib/voice/voiceSettings";

/** Lets chained `.then` callbacks in the controller run under fake timers. */
async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

class MockEnvironment implements VoiceLoopEnvironment {
  primed = 0;
  support = { recognition: true, synthesis: true };
  spoken: string[] = [];
  speechHandlers: VoiceSpeechHandlers | null = null;
  cancels = 0;
  rates: number[] = [];

  captureOpens = 0;
  captureStops = 0;
  captureError: unknown = null;
  captureCallbacks: VoiceCaptureCallbacks | null = null;

  restarts = 0;
  restartThrows = false;

  submits: string[] = [];
  submitBehavior: "deferred" | "error" | "ignored" = "deferred";
  submitError: unknown = new Error("We couldn't send your answer.");
  private resolveSubmit: ((outcome: SubmitOutcome) => void) | null = null;
  private rejectSubmit: ((error: unknown) => void) | null = null;

  primeAudio(): void {
    this.primed += 1;
  }

  checkSupport(): { recognition: boolean; synthesis: boolean } {
    return { ...this.support };
  }

  startSpeech(text: string, handlers: VoiceSpeechHandlers): void {
    this.spoken.push(text);
    this.speechHandlers = handlers;
  }

  cancelSpeech(): void {
    this.cancels += 1;
    this.speechHandlers = null;
  }

  setRate(rate: number): void {
    this.rates.push(rate);
  }

  async startCapture(callbacks: VoiceCaptureCallbacks): Promise<void> {
    this.captureOpens += 1;
    this.captureCallbacks = callbacks;
    if (this.captureError !== null) {
      const error = this.captureError;
      this.captureError = null;
      throw error;
    }
  }

  stopCapture(): void {
    this.captureStops += 1;
    this.captureCallbacks = null;
  }

  restartRecognition(): void {
    if (this.restartThrows) throw new Error("InvalidStateError");
    this.restarts += 1;
  }

  submit(text: string): Promise<SubmitOutcome> {
    this.submits.push(text);
    if (this.submitBehavior === "error") return Promise.reject(this.submitError);
    if (this.submitBehavior === "ignored") return Promise.resolve({ status: "ignored" });
    return new Promise<SubmitOutcome>((resolve, reject) => {
      this.resolveSubmit = resolve;
      this.rejectSubmit = reject;
    });
  }

  resolveNext(questionText: string): void {
    this.resolveSubmit?.({ status: "next", questionText });
    this.resolveSubmit = null;
    this.rejectSubmit = null;
  }

  resolveCompleted(): void {
    this.resolveSubmit?.({ status: "completed" });
    this.resolveSubmit = null;
    this.rejectSubmit = null;
  }

  failSubmit(error: unknown): void {
    this.rejectSubmit?.(error);
    this.resolveSubmit = null;
    this.rejectSubmit = null;
  }

  fireSpeechStart(): void {
    this.speechHandlers?.onStart();
  }

  fireSpeechEnd(): void {
    this.speechHandlers?.onEnd();
  }

  fireSpeechError(): void {
    this.speechHandlers?.onError();
  }

  fireFinal(text: string): void {
    this.captureCallbacks?.onFinal(text);
  }

  fireInterim(text: string): void {
    this.captureCallbacks?.onInterim(text);
  }

  fireLevel(rms: number): void {
    this.captureCallbacks?.onLevel(rms, Date.now());
  }

  fireRecognitionEnd(shouldRestart = true): void {
    this.captureCallbacks?.onEnd(shouldRestart);
  }

  fireRecognitionError(message: string, code?: string): void {
    this.captureCallbacks?.onError(message, code);
  }
}

const QUESTION = "Tell me about a difficult project you shipped.";

function createController(settings: Partial<VoiceSettings> = {}) {
  const env = new MockEnvironment();
  const controller = new VoiceInterviewController(env, {
    ...DEFAULT_VOICE_SETTINGS,
    ...settings,
  });
  return { env, controller };
}

/** Plays the question aloud and lands in `listening` with the mic open. */
async function reachListening(
  env: MockEnvironment,
  controller: VoiceInterviewController,
  question = QUESTION,
): Promise<void> {
  controller.dispatch({ type: "enable", question });
  expect(controller.stateName).toBe("speaking");
  env.fireSpeechStart();
  env.fireSpeechEnd();
  expect(controller.stateName).toBe("listening");
  await flush();
  expect(env.captureOpens).toBe(1);
  expect(controller.getSnapshot().capturePending).toBe(false);
}

/**
 * Calibrates the detector with a quiet frame, then simulates a qualified
 * utterance (optionally with recognised text).
 */
function speakUp(env: MockEnvironment, text?: string): void {
  env.fireLevel(0.01); // inside the calibration window
  vi.advanceTimersByTime(600);
  env.fireLevel(0.01); // closes calibration: floor 0.01 → threshold 0.017
  vi.advanceTimersByTime(50);
  env.fireLevel(0.08); // speech begins
  if (text !== undefined) env.fireFinal(text);
}

function fallSilent(env: MockEnvironment): void {
  vi.advanceTimersByTime(300);
  env.fireLevel(0.01);
}

describe("VoiceInterviewController", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes helpers used by the UI", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one   two ")).toBe(2);
    expect(isListeningState("listening")).toBe(true);
    expect(isListeningState("silence_countdown")).toBe(true);
    expect(isListeningState("speaking")).toBe(false);
    expect(isListeningState("submitting")).toBe(false);
  });

  it("runs the full question → speaking → listening → hearing → countdown → submit loop", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    expect(env.spoken).toEqual([QUESTION]);
    // The microphone must never open while the interviewer is talking.
    expect(env.captureOpens).toBe(1);
    expect(env.primed).toBeGreaterThan(0);

    speakUp(env, "I led a payments migration with zero downtime.");
    expect(controller.stateName).toBe("hearing");
    expect(controller.getSnapshot().transcript).toContain("payments migration");
    expect(controller.getSnapshot().micLevel).toBeGreaterThan(0);

    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");
    expect(controller.getSnapshot().countdownRemainingMs).toBeGreaterThan(0);

    vi.advanceTimersByTime(4_500);
    expect(controller.stateName).toBe("submitting");
    expect(env.submits).toEqual(["I led a payments migration with zero downtime."]);

    env.resolveNext("What is your testing strategy?");
    await flush();
    expect(controller.stateName).toBe("speaking");
    expect(env.spoken[1]).toBe("What is your testing strategy?");
    // Previous answer text must not survive into the next question.
    expect(controller.getSnapshot().transcript).toBe("");

    env.fireSpeechStart();
    env.fireSpeechEnd();
    await flush();
    expect(controller.stateName).toBe("listening");
    expect(env.captureOpens).toBe(2);
    expect(env.captureStops).toBeGreaterThanOrEqual(1);
  });

  it("auto-sends after the configured silence delay (default 4500ms)", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "My answer here for the panel.");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");

    vi.advanceTimersByTime(4_400);
    expect(controller.stateName).toBe("silence_countdown");
    expect(env.submits).toHaveLength(0);

    vi.advanceTimersByTime(150);
    expect(controller.stateName).toBe("submitting");
    expect(env.submits).toHaveLength(1);
  });

  it("pausing for 2s during the countdown does not send, and resume finishes the countdown", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "A considered answer that should not send early.");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");

    vi.advanceTimersByTime(2_000);
    controller.dispatch({ type: "pause" });
    expect(controller.stateName).toBe("paused");

    vi.advanceTimersByTime(2_500);
    expect(env.submits).toHaveLength(0);
    expect(controller.stateName).toBe("paused");

    controller.dispatch({ type: "resume" });
    expect(controller.stateName).toBe("silence_countdown");
    vi.advanceTimersByTime(2_600);
    expect(controller.stateName).toBe("submitting");
    expect(env.submits).toHaveLength(1);
  });

  it("never auto-sends an empty or near-empty answer", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);

    // Send now with nothing captured is a no-op.
    controller.dispatch({ type: "send_now" });
    expect(env.submits).toHaveLength(0);
    expect(controller.stateName).toBe("listening");

    // Qualified speech that produced no recognition text.
    speakUp(env);
    vi.advanceTimersByTime(400);
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");
    vi.advanceTimersByTime(4_600);
    expect(controller.stateName).toBe("listening");
    expect(env.submits).toHaveLength(0);

    // A single stray word is still below the auto-send threshold.
    speakUp(env, "Yeah");
    vi.advanceTimersByTime(400);
    fallSilent(env);
    vi.advanceTimersByTime(4_600);
    expect(controller.stateName).toBe("listening");
    expect(env.submits).toHaveLength(0);
    expect(countWords("Yeah")).toBeLessThan(MIN_AUTO_SEND_WORDS);
  });

  it("re-speaking cancels the countdown so nothing sends while the user talks", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "First part of my answer.");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");

    vi.advanceTimersByTime(2_000);
    env.fireLevel(0.09); // user continues talking
    expect(controller.stateName).toBe("hearing");
    expect(controller.getSnapshot().countdownRemainingMs).toBeNull();

    // The original deadline passes with no send.
    vi.advanceTimersByTime(3_000);
    expect(env.submits).toHaveLength(0);
    expect(controller.stateName).toBe("hearing");
  });

  it("guards against double submission", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "Only this should be submitted once.");
    fallSilent(env);

    controller.dispatch({ type: "send_now" });
    expect(controller.stateName).toBe("submitting");
    // Further sends while submitting are ignored.
    controller.dispatch({ type: "send_now" });
    controller.dispatch({ type: "pause" });
    expect(env.submits).toHaveLength(1);
    expect(controller.stateName).toBe("submitting");

    // A stale resolution for an old request id is dropped.
    controller.dispatch({
      type: "submit_resolved",
      requestId: 99,
      outcome: { status: "next", questionText: "Stale" },
    });
    expect(controller.stateName).toBe("submitting");
    expect(env.spoken).not.toContain("Stale");

    env.resolveNext("Next question?");
    await flush();
    expect(controller.stateName).toBe("speaking");
    expect(env.spoken).toHaveLength(2);
  });

  it("keeps the transcript on a network failure and retries the same text", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "Answer that failed to send.");
    fallSilent(env);
    env.submitBehavior = "error";

    vi.advanceTimersByTime(4_600);
    await flush();
    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("network");
    expect(controller.getSnapshot().errorMessage).toContain(
      "We couldn't send your answer.",
    );
    expect(controller.getSnapshot().transcript).toContain("Answer that failed");

    // Retry reuses the exact same submission path and text.
    env.submitBehavior = "deferred";
    controller.dispatch({ type: "retry" });
    expect(controller.stateName).toBe("submitting");
    expect(env.submits[1]).toBe("Answer that failed to send.");

    env.resolveCompleted();
    await flush();
    expect(controller.stateName).toBe("idle");
    expect(controller.getSnapshot().enabled).toBe(false);
  });

  it("restarts recognition a bounded number of times, then fails typed", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);

    for (let attempt = 0; attempt < MAX_RECOGNITION_RESTARTS; attempt += 1) {
      env.fireRecognitionEnd(true);
      await flush();
    }
    expect(env.restarts).toBe(MAX_RECOGNITION_RESTARTS);
    expect(controller.stateName).toBe("listening");

    env.fireRecognitionEnd(true);
    await flush();
    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("recognition_stopped");

    // A failed restart attempt maps to the same typed error.
    controller.dispatch({ type: "retry" });
    expect(controller.stateName).toBe("listening");
    await flush(); // the microphone/reopen cycle settles before recognising
    env.restartThrows = true;
    env.fireRecognitionEnd(true);
    await flush();
    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("recognition_stopped");
  });

  it("maps a denied microphone to a typed error and recovers on retry", async () => {
    const { env, controller } = createController();
    env.captureError = new VoiceCaptureError("mic_permission");
    controller.dispatch({ type: "enable", question: QUESTION });
    env.fireSpeechStart();
    env.fireSpeechEnd();
    await flush();

    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("mic_permission");
    expect(controller.getSnapshot().errorMessage).toContain("Microphone access is blocked");
    expect(env.captureOpens).toBe(1);

    controller.dispatch({ type: "retry" });
    expect(controller.stateName).toBe("listening");
    await flush();
    expect(env.captureOpens).toBe(2);
    expect(controller.getSnapshot().capturePending).toBe(false);
  });

  it("maps a missing microphone to a typed error", async () => {
    const { env, controller } = createController();
    env.captureError = new VoiceCaptureError("mic_not_found");
    controller.dispatch({ type: "enable", question: QUESTION });
    env.fireSpeechStart();
    env.fireSpeechEnd();
    await flush();

    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("mic_not_found");
  });

  it("offers tap-to-start when audio is blocked, then falls back to listening with a warning", async () => {
    const { env, controller } = createController();
    controller.dispatch({ type: "enable", question: QUESTION });
    expect(controller.stateName).toBe("speaking");

    // No TTS start within the watchdog window → ask for one explicit tap.
    vi.advanceTimersByTime(TTS_START_TIMEOUT_MS);
    expect(controller.getSnapshot().needsTapToStart).toBe(true);
    expect(controller.stateName).toBe("speaking");
    const attempts = env.spoken.length;

    controller.dispatch({ type: "tap_to_start" });
    expect(env.primed).toBeGreaterThan(1);
    expect(env.spoken.length).toBe(attempts + 1);
    expect(controller.getSnapshot().needsTapToStart).toBe(false);

    // Still no audio → show the question on screen, skip to listening.
    vi.advanceTimersByTime(TTS_START_TIMEOUT_MS);
    await flush();
    expect(controller.stateName).toBe("listening");
    expect(controller.getSnapshot().notice).toBe(TTS_WARNING_MESSAGE);
    expect(env.captureOpens).toBe(1);
  });

  it("skips straight to listening when synthesis is unsupported", async () => {
    const { env, controller } = createController();
    env.support.synthesis = false;
    controller.dispatch({ type: "enable", question: QUESTION });
    await flush();

    expect(controller.stateName).toBe("listening");
    expect(controller.getSnapshot().notice).toBe(TTS_WARNING_MESSAGE);
    expect(env.spoken).toHaveLength(0);
    expect(env.captureOpens).toBe(1);
  });

  it("fails typed when speech recognition is unsupported and ignores retry", async () => {
    const { env, controller } = createController();
    env.support.recognition = false;
    controller.dispatch({ type: "enable", question: QUESTION });

    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("stt_unsupported");
    expect(controller.getSnapshot().errorMessage).toContain("text mode");

    controller.dispatch({ type: "retry" });
    expect(controller.stateName).toBe("error");
    expect(env.captureOpens).toBe(0);
  });

  it("mutes the microphone without leaving the listening state, and unmute reopens it", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);

    controller.dispatch({ type: "toggle_mute" });
    expect(controller.getSnapshot().micMuted).toBe(true);
    expect(controller.stateName).toBe("listening");
    expect(env.captureStops).toBeGreaterThanOrEqual(1);
    const opensWhileMuted = env.captureOpens;

    // Levels cannot arrive while muted.
    env.fireLevel(0.09);
    expect(controller.getSnapshot().micLevel).toBe(0);

    controller.dispatch({ type: "toggle_mute" });
    expect(controller.getSnapshot().micMuted).toBe(false);
    await flush();
    expect(env.captureOpens).toBe(opensWhileMuted + 1);
  });

  it("supports skip, replay and redo without breaking the loop", async () => {
    const { env, controller } = createController();
    controller.dispatch({ type: "enable", question: QUESTION });
    controller.dispatch({ type: "skip_audio" });
    await flush();
    expect(controller.stateName).toBe("listening");
    expect(env.captureOpens).toBe(1);

    controller.dispatch({ type: "replay" });
    expect(controller.stateName).toBe("speaking");
    expect(env.spoken).toHaveLength(2);
    env.fireSpeechEnd();
    await flush();
    expect(controller.stateName).toBe("listening");

    speakUp(env, "Draft answer");
    expect(controller.getSnapshot().transcript).toBe("Draft answer");
    controller.dispatch({ type: "redo" });
    expect(controller.stateName).toBe("listening");
    expect(controller.getSnapshot().transcript).toBe("");
    expect(controller.getSnapshot().errorReason).toBeNull();
  });

  it("shows the gentle 15s prompt once per capture window when nobody speaks", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    expect(controller.getSnapshot().notice).toBeNull();

    vi.advanceTimersByTime(NO_SPEECH_PROMPT_MS);
    expect(controller.stateName).toBe("listening");
    expect(controller.getSnapshot().notice).toBe(NO_SPEECH_PROMPT_MESSAGE);

    // The prompt does not repeat within the same window.
    controller.dispatch({ type: "pause" });
    controller.dispatch({ type: "resume" });
    vi.advanceTimersByTime(NO_SPEECH_PROMPT_MS * 2);
    expect(controller.getSnapshot().notice).toBe(NO_SPEECH_PROMPT_MESSAGE);
  });

  it("absorbs soft recognition errors and surfaces hard ones typed", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);

    env.fireRecognitionError("I didn't hear anything. Try again.", "no-speech");
    expect(controller.stateName).toBe("listening");

    env.fireRecognitionError("Voice recognition needs an internet connection.", "network");
    expect(controller.stateName).toBe("listening");
    expect(controller.getSnapshot().notice).toContain("internet connection");

    env.fireRecognitionError(
      "Microphone permission is blocked. Allow it in the browser's site settings.",
      "not-allowed",
    );
    expect(controller.stateName).toBe("error");
    expect(controller.getSnapshot().errorReason).toBe("mic_permission");
  });

  it("keeps manual control out of submitting and error states", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "Answer");
    fallSilent(env);
    controller.dispatch({ type: "send_now" });
    expect(controller.stateName).toBe("submitting");

    controller.dispatch({ type: "pause" });
    controller.dispatch({ type: "toggle_mute" });
    controller.dispatch({ type: "redo" });
    expect(controller.stateName).toBe("submitting");

    env.resolveNext("Another question?");
    await flush();
    expect(controller.stateName).toBe("speaking");
    expect(controller.getSnapshot().transcript).toBe("");
  });

  it("returns to listening when the submission path reports the call as ignored", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "Answer");
    fallSilent(env);
    env.submitBehavior = "ignored";

    controller.dispatch({ type: "send_now" });
    await flush();
    expect(controller.stateName).toBe("listening");
    expect(env.submits).toHaveLength(1);
  });

  it("applies settings updates and clamps them into range", async () => {
    const { env, controller } = createController();
    controller.updateSettings({ voiceRate: 99, silenceDelayMs: 1 });
    expect(controller.getSettings().voiceRate).toBe(1.4);
    expect(controller.getSettings().silenceDelayMs).toBe(4000);
    expect(env.rates.at(-1)).toBe(1.4);

    await reachListening(env, controller);
    speakUp(env, "An answer");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");

    // Turning auto-send off drops the running countdown back to manual.
    controller.updateSettings({ autoSend: false });
    expect(controller.stateName).toBe("listening");
    vi.advanceTimersByTime(6_000);
    expect(env.submits).toHaveLength(0);

    controller.updateSettings({ autoSend: true });
    speakUp(env, "More words added later");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");
    vi.advanceTimersByTime(4_100);
    expect(env.submits).toHaveLength(1);
  });

  it("disable releases every timer, the microphone and pending work", async () => {
    const { env, controller } = createController();
    await reachListening(env, controller);
    speakUp(env, "Half a thought");
    fallSilent(env);
    expect(controller.stateName).toBe("silence_countdown");
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    controller.dispatch({ type: "disable" });
    expect(controller.stateName).toBe("idle");
    expect(vi.getTimerCount()).toBe(0);
    expect(env.cancels).toBeGreaterThan(0);
    expect(env.captureStops).toBeGreaterThanOrEqual(1);
    const snapshot: VoiceLoopSnapshot = controller.getSnapshot();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.transcript).toBe("");
    expect(snapshot.countdownRemainingMs).toBeNull();
    expect(snapshot.errorReason).toBeNull();
    expect(snapshot.micMuted).toBe(false);

    // Late events after disabling are ignored.
    env.fireLevel(0.09);
    env.fireFinal("ghost text");
    expect(controller.getSnapshot().transcript).toBe("");
    expect(controller.stateName).toBe("idle");
  });

  it("dispose is terminal and stops accepting events", () => {
    const { env, controller } = createController();
    controller.dispatch({ type: "enable", question: QUESTION });
    env.fireSpeechStart();
    controller.dispose();
    const stateAfterDispose: VoiceLoopState = controller.stateName;
    expect(stateAfterDispose).toBe("idle");
    controller.dispatch({ type: "enable", question: QUESTION });
    expect(controller.stateName).toBe("idle");
    expect(env.captureOpens).toBe(0);
  });

  it("seeds a typed draft when voice mode is enabled", async () => {
    const { env, controller } = createController();
    controller.dispatch({ type: "enable", question: QUESTION, seedTranscript: " my draft " });
    expect(controller.getSnapshot().transcript).toBe("my draft");
    env.fireSpeechStart();
    env.fireSpeechEnd();
    await flush();
    expect(controller.getSnapshot().transcript).toBe("my draft");
  });
});
