"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from "react";
import { toast } from "sonner";
import {
  INITIAL_VOICE_SNAPSHOT,
  VoiceInterviewController,
} from "./VoiceInterviewController";
import type {
  SubmitOutcome,
  VoiceCaptureCallbacks,
  VoiceLoopEnvironment,
  VoiceLoopSnapshot,
} from "./VoiceInterviewController";
import { MicLevelMeter, getAudioContextConstructor } from "./MicLevelMeter";
import { WebSpeechRecognizer, findSpeechRecognitionConstructor } from "./WebSpeechRecognizer";
import { WebSpeechSynthesizer } from "./WebSpeechSynthesizer";
import { VoiceCaptureError } from "./types";
import type { SpeechSynthesizer } from "./types";
import {
  DEFAULT_VOICE_SETTINGS,
  loadVoiceSettings,
  normalizeVoiceSettings,
  saveVoiceSettings,
} from "./voiceSettings";
import type { VoiceSettings } from "./voiceSettings";

/**
 * Chrome can drop a `speak()` issued immediately after `cancel()`; separate
 * the two by a tick so every new question reliably starts playing.
 */
const SPEECH_QUEUE_DELAY_MS = 120;

const getServerSnapshot = (): VoiceLoopSnapshot => INITIAL_VOICE_SNAPSHOT;

/**
 * Latest-value bindings the environment reads from. A plain mutable object
 * (not a ref) is used so it can be created inside `useState` and refreshed
 * from an effect without tripping the React compiler's ref rules.
 */
interface VoiceLoopBindings {
  submit: (text: string) => Promise<SubmitOutcome>;
  language: string;
}

interface EnvironmentBundle {
  env: VoiceLoopEnvironment;
  /** Refreshes the latest submit path/language after mount. */
  update(next: VoiceLoopBindings): void;
  dispose(): void;
}

function createEnvironment(): EnvironmentBundle {
  // Safe placeholder until the hook's first effect installs the real
  // bindings; no interaction can reach `submit` before that happens.
  let bindings: VoiceLoopBindings = {
    submit: () => Promise.resolve({ status: "ignored" }),
    language: "en-US",
  };
  let recognizer: WebSpeechRecognizer | null = null;
  let synthesizer: SpeechSynthesizer | null = null;
  let audioContext: AudioContext | null = null;
  let meter: MicLevelMeter | null = null;
  let capturing = false;
  let captureSession = 0;
  let speechToken = 0;
  let speechTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingRate = DEFAULT_VOICE_SETTINGS.voiceRate;

  const getAudioContext = (): AudioContext | null => {
    if (audioContext && audioContext.state !== "closed") return audioContext;
    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) return null;
    try {
      audioContext = new AudioContextCtor();
    } catch {
      audioContext = null;
    }
    return audioContext;
  };

  const getRecognizer = (): WebSpeechRecognizer | null => {
    recognizer ??= WebSpeechRecognizer.create(bindings.language);
    return recognizer;
  };

  const getSynthesizer = (): SpeechSynthesizer | null => {
    if (synthesizer) return synthesizer;
    if (
      typeof window === "undefined" ||
      typeof window.speechSynthesis === "undefined" ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return null;
    }
    try {
      const created = new WebSpeechSynthesizer(window.speechSynthesis, (text) => {
        return new SpeechSynthesisUtterance(text);
      });
      created.setRate(pendingRate);
      synthesizer = created;
      return synthesizer;
    } catch {
      return null;
    }
  };

  const unwireRecognizer = (): void => {
    if (!recognizer) return;
    recognizer.onInterimResult = null;
    recognizer.onFinalResult = null;
    recognizer.onNotice = null;
    recognizer.onError = null;
    recognizer.onEnd = null;
  };

  const stopCaptureInternal = (): void => {
    capturing = false;
    unwireRecognizer();
    if (recognizer) {
      try {
        // `abort` releases the microphone immediately and drops pending
        // results so no stale transcript can bleed into the next answer.
        recognizer.abort();
      } catch {
        // Recognition was already inactive.
      }
    }
    if (meter) {
      meter.dispose();
      meter = null;
    }
  };

  return {
    env: {
      primeAudio(): void {
        if (typeof window === "undefined") return;
        const context = getAudioContext();
        if (context && context.state === "suspended") {
          void context.resume().catch(() => undefined);
        }
        try {
          if (
            typeof window.speechSynthesis !== "undefined" &&
            typeof SpeechSynthesisUtterance !== "undefined"
          ) {
            // A silent utterance inside the user gesture unlocks speech
            // synthesis on iOS/Safari for all later questions.
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
          }
        } catch {
          // Synthesis unlock is best-effort; failures surface later as a
          // skipped-to-listening fallback with a warning.
        }
      },

      checkSupport(): { recognition: boolean; synthesis: boolean } {
        if (typeof window === "undefined") return { recognition: false, synthesis: false };
        return {
          recognition: findSpeechRecognitionConstructor(window) !== null,
          synthesis:
            typeof window.speechSynthesis !== "undefined" &&
            typeof SpeechSynthesisUtterance !== "undefined",
        };
      },

      startSpeech(text, handlers): void {
        speechToken += 1;
        const token = speechToken;
        if (speechTimer !== null) {
          clearTimeout(speechTimer);
          speechTimer = null;
        }
        const synth = getSynthesizer();
        if (!synth) {
          handlers.onError();
          return;
        }
        synth.cancel();
        speechTimer = setTimeout(() => {
          speechTimer = null;
          if (token !== speechToken) return;
          try {
            synth.onStart = () => {
              if (token === speechToken) handlers.onStart();
            };
            synth.onEnd = () => {
              if (token === speechToken) handlers.onEnd();
            };
            synth.onError = () => {
              if (token === speechToken) handlers.onError();
            };
            synth.setRate(pendingRate);
            synth.speak(text);
          } catch {
            if (token === speechToken) handlers.onError();
          }
        }, SPEECH_QUEUE_DELAY_MS);
      },

      cancelSpeech(): void {
        speechToken += 1;
        if (speechTimer !== null) {
          clearTimeout(speechTimer);
          speechTimer = null;
        }
        if (synthesizer) {
          synthesizer.onStart = null;
          synthesizer.onEnd = null;
          synthesizer.onError = null;
          synthesizer.onBoundary = null;
          synthesizer.cancel();
        }
      },

      setRate(rate: number): void {
        pendingRate = rate;
        synthesizer?.setRate(rate);
      },

      async startCapture(callbacks: VoiceCaptureCallbacks): Promise<void> {
        const session = ++captureSession;
        const rec = getRecognizer();
        if (!rec) throw new VoiceCaptureError("stt_unsupported");
        if (capturing) stopCaptureInternal();

        const newMeter = new MicLevelMeter(
          (rms, nowMs) => callbacks.onLevel(rms, nowMs),
          getAudioContext() ?? undefined,
        );
        try {
          await newMeter.start();
        } catch (error) {
          newMeter.dispose();
          throw error;
        }
        if (session !== captureSession) {
          // stopCapture() landed while the permission prompt was open.
          newMeter.dispose();
          throw new VoiceCaptureError("unknown", "Voice capture was stopped.");
        }

        rec.onInterimResult = (text) => callbacks.onInterim(text);
        rec.onFinalResult = (text) => callbacks.onFinal(text);
        rec.onNotice = (message) => callbacks.onNotice(message);
        rec.onError = (message, code) => callbacks.onError(message, code);
        rec.onEnd = (shouldRestart) => callbacks.onEnd(shouldRestart ?? true);
        try {
          rec.start();
        } catch {
          unwireRecognizer();
          newMeter.dispose();
          throw new VoiceCaptureError(
            "unknown",
            "Voice recognition could not start. Try again, or switch to text mode.",
          );
        }
        meter = newMeter;
        capturing = true;
      },

      stopCapture(): void {
        captureSession += 1;
        stopCaptureInternal();
      },

      restartRecognition(): void {
        if (!capturing || !recognizer) return;
        // Throws InvalidStateError if the engine refuses; the controller maps
        // that to a typed `recognition_stopped` error.
        recognizer.start();
      },

      submit(text: string): Promise<SubmitOutcome> {
        return bindings.submit(text);
      },
    },
    update(next: VoiceLoopBindings): void {
      bindings = next;
    },
    dispose(): void {
      stopCaptureInternal();
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
      audioContext = null;
      synthesizer = null;
      recognizer = null;
    },
  };
}

export interface VoiceLoopActions {
  enable(options?: { question?: string; seedTranscript?: string }): void;
  disable(): void;
  pause(): void;
  resume(): void;
  toggleMute(): void;
  skipAudio(): void;
  sendNow(): void;
  redo(): void;
  replay(): void;
  retry(): void;
  tapToStart(): void;
  /**
   * Speaks an interviewer line outside the submit cycle — used when the clock
   * runs out mid-answer so the closing line is still heard.
   */
  speak(text: string): void;
}

export interface UseVoiceInterviewLoopArgs {
  language: string;
  /** The one submission path, shared with the manual Send button. */
  submit: (text: string) => Promise<SubmitOutcome>;
}

/**
 * Bridges {@link VoiceInterviewController} to React: owns the controller and
 * its browser environment, persists settings, releases everything on unmount
 * or `pagehide`, and surfaces non-blocking notices as toasts.
 */
export function useVoiceInterviewLoop({ language, submit }: UseVoiceInterviewLoopArgs) {
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [bundle] = useState(() => createEnvironment());
  const [controller] = useState(
    () => new VoiceInterviewController(bundle.env, loadVoiceSettings()),
  );

  // Install the latest bindings after mount so the environment always calls
  // the current submit path without reading values during render.
  useEffect(() => {
    bundle.update({ submit, language });
  }, [bundle, submit, language]);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    controller.updateSettings(settings);
    saveVoiceSettings(settings);
  }, [controller, settings]);

  const lastNoticeRef = useRef<string | null>(null);
  useEffect(() => {
    const notice = snapshot.notice;
    if (notice === null) {
      lastNoticeRef.current = null;
      return;
    }
    if (lastNoticeRef.current === notice) return;
    lastNoticeRef.current = notice;
    toast.info(notice, { duration: 5000, position: "bottom-right" });
  }, [snapshot.notice]);

  useEffect(() => {
    const onPageHide = (): void => controller.disable();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // Also covers React StrictMode's simulated unmount: idempotent and
      // leaves the environment reusable.
      controller.disable();
      bundle.dispose();
    };
  }, [controller, bundle]);

  const patchSettings = useCallback((patch: Partial<VoiceSettings>): void => {
    setSettings((previous) => normalizeVoiceSettings({ ...previous, ...patch }));
  }, []);

  const actions = useMemo<VoiceLoopActions>(
    () => ({
      enable: (options) =>
        controller.dispatch({
          type: "enable",
          question: options?.question,
          seedTranscript: options?.seedTranscript,
        }),
      disable: () => controller.dispatch({ type: "disable" }),
      pause: () => controller.dispatch({ type: "pause" }),
      resume: () => controller.dispatch({ type: "resume" }),
      toggleMute: () => controller.dispatch({ type: "toggle_mute" }),
      skipAudio: () => controller.dispatch({ type: "skip_audio" }),
      sendNow: () => controller.dispatch({ type: "send_now" }),
      redo: () => controller.dispatch({ type: "redo" }),
      replay: () => controller.dispatch({ type: "replay" }),
      retry: () => controller.dispatch({ type: "retry" }),
      tapToStart: () => controller.dispatch({ type: "tap_to_start" }),
      speak: (text) => {
        if (text.trim() === "") return;
        controller.dispatch({ type: "question", text });
      },
    }),
    [controller],
  );

  return { snapshot, settings, patchSettings, actions };
}
