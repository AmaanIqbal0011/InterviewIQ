"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { VoiceController } from "./VoiceController";
import { WebSpeechRecognizer } from "./WebSpeechRecognizer";
import { WebSpeechSynthesizer } from "./WebSpeechSynthesizer";
import type { VoiceState } from "./types";

interface VoiceInterviewSnapshot {
  state: VoiceState;
  transcript: string;
  recognitionSupported: boolean;
  synthesisSupported: boolean;
  error: string | null;
  notice: string | null;
}

const INITIAL_SNAPSHOT: VoiceInterviewSnapshot = {
  state: "idle",
  transcript: "",
  recognitionSupported: false,
  synthesisSupported: false,
  error: null,
  notice: null,
};

class VoiceInterviewStore {
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private controller: VoiceController | null = null;
  private finalTranscript = "";
  private lastToastError: string | null = null;
  private toastResetTimeout: number | null = null;
  private removePageHideListener: (() => void) | null = null;
  private readonly voiceStateListeners = new Set<(state: VoiceState) => void>();
  private readonly speechBoundaryListeners = new Set<(charIndex: number) => void>();

  constructor(
    private readonly language: string,
    private readonly onTranscriptChange?: (text: string) => void,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): VoiceInterviewSnapshot => this.snapshot;

  getServerSnapshot = (): VoiceInterviewSnapshot => INITIAL_SNAPSHOT;

  mount(): void {
    if (typeof window === "undefined" || this.controller) return;

    let setupError: string | null = null;
    let recognizer: WebSpeechRecognizer | null = null;
    try {
      recognizer = WebSpeechRecognizer.create(this.language);
    } catch {
      setupError = "Voice input could not be initialized. You can still type.";
    }

    let synthesizer: WebSpeechSynthesizer | null = null;
    const canSynthesize =
      typeof window.speechSynthesis !== "undefined" &&
      typeof SpeechSynthesisUtterance !== "undefined";
    if (canSynthesize) {
      try {
        synthesizer = new WebSpeechSynthesizer(
          window.speechSynthesis,
          (text) => new SpeechSynthesisUtterance(text),
        );
      } catch {
        setupError = "AI voice could not be initialized. You can still read the questions.";
      }
    }

    const controller = new VoiceController(recognizer, synthesizer);
    controller.onStateChange = (state) => {
      this.update({ state });
      this.voiceStateListeners.forEach((listener) => listener(state));
    };
    controller.onSpeechBoundary = (charIndex) => {
      this.speechBoundaryListeners.forEach((listener) => listener(charIndex));
    };
    controller.onError = (error) => {
      this.update({ error });
      this.showErrorToast(error);
    };
    controller.onNotice = (notice) => this.update({ notice });
    controller.onInterimResult = (interim) => {
      if (controller.state !== "listening") return;
      this.updateTranscript(
        [this.finalTranscript.trim(), interim.trim()].filter(Boolean).join(" "),
      );
    };
    controller.onFinalResult = (finalText) => {
      if (controller.state !== "listening") return;
      this.finalTranscript = [
        this.finalTranscript.trim(),
        finalText.trim(),
      ].filter(Boolean).join(" ");
      this.updateTranscript(this.finalTranscript);
    };
    this.controller = controller;
    this.update({
      recognitionSupported: recognizer !== null,
      synthesisSupported: synthesizer !== null,
      error: setupError,
    });
    if (setupError) this.showErrorToast(setupError);

    const stopOnPageHide = (): void => controller.stop();
    window.addEventListener("pagehide", stopOnPageHide);
    this.removePageHideListener = () => window.removeEventListener("pagehide", stopOnPageHide);
  }

  startListening = (initialText: string): void => {
    this.finalTranscript = initialText;
    this.update({ error: null });
    this.updateTranscript(initialText);
    this.controller?.startListening();
  };

  updateDraft = (text: string): void => {
    if (this.controller?.state !== "listening") return;
    this.finalTranscript = text;
    this.updateTranscript(text);
  };

  stopListening = (): void => this.controller?.stopListening();
  speak = (text: string): void => this.controller?.speak(text);
  cancelSpeech = (): void => this.controller?.cancelSpeech();
  setRate = (rate: number): void => this.controller?.setRate(rate);
  beginProcessing = (): void => this.controller?.beginProcessing();
  finishProcessing = (): void => this.controller?.finishProcessing();
  stop = (): void => this.controller?.stop();

  subscribeVoiceState = (listener: (state: VoiceState) => void): (() => void) => {
    this.voiceStateListeners.add(listener);
    listener(this.snapshot.state);
    return () => this.voiceStateListeners.delete(listener);
  };

  subscribeSpeechBoundary = (listener: (charIndex: number) => void): (() => void) => {
    this.speechBoundaryListeners.add(listener);
    return () => this.speechBoundaryListeners.delete(listener);
  };

  dispose(): void {
    this.removePageHideListener?.();
    this.removePageHideListener = null;
    if (this.toastResetTimeout !== null) {
      window.clearTimeout(this.toastResetTimeout);
      this.toastResetTimeout = null;
    }
    this.controller?.dispose();
    this.controller = null;
    this.voiceStateListeners.clear();
    this.speechBoundaryListeners.clear();
  }

  private updateTranscript(transcript: string): void {
    this.update({ transcript });
    this.onTranscriptChange?.(transcript);
  }

  private showErrorToast(error: string): void {
    if (this.lastToastError === error) return;
    this.lastToastError = error;
    toast.error(error, { duration: 5000, position: "bottom-right" });
    if (this.toastResetTimeout !== null) window.clearTimeout(this.toastResetTimeout);
    this.toastResetTimeout = window.setTimeout(() => {
      this.lastToastError = null;
      this.toastResetTimeout = null;
    }, 5000);
  }

  private update(patch: Partial<VoiceInterviewSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}

export function useVoiceInterview(
  language: string,
  onTranscriptChange?: (text: string) => void,
) {
  const store = useMemo(
    () => new VoiceInterviewStore(language, onTranscriptChange),
    [language, onTranscriptChange],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    store.mount();
    return () => store.dispose();
  }, [store]);

  return {
    ...snapshot,
    startListening: store.startListening,
    updateDraft: store.updateDraft,
    stopListening: store.stopListening,
    speak: store.speak,
    cancelSpeech: store.cancelSpeech,
    setRate: store.setRate,
    beginProcessing: store.beginProcessing,
    finishProcessing: store.finishProcessing,
    stop: store.stop,
    subscribeVoiceState: store.subscribeVoiceState,
    subscribeSpeechBoundary: store.subscribeSpeechBoundary,
  };
}
