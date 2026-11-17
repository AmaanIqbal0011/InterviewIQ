import type { SpeechRecognizer, SpeechSynthesizer, VoiceState } from "./types";
import { getRecognitionErrorMessage } from "./WebSpeechRecognizer";

const MAX_RECOGNITION_RESTARTS = 3;

export function sanitizeSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`*_~#\[\]{}|]/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}\p{P}\p{Z}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class VoiceController {
  onStateChange: ((state: VoiceState) => void) | null = null;
  onInterimResult: ((text: string) => void) | null = null;
  onFinalResult: ((text: string) => void) | null = null;
  onNotice: ((message: string) => void) | null = null;
  onSpeechBoundary: ((charIndex: number) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  private currentState: VoiceState = "idle";
  private shouldListen = false;
  private recognitionActive = false;
  private restartCount = 0;
  private disposed = false;

  constructor(
    private readonly recognizer: SpeechRecognizer | null,
    private readonly synthesizer: SpeechSynthesizer | null,
  ) {
    if (recognizer) {
      recognizer.onInterimResult = (text) => this.onInterimResult?.(text);
      recognizer.onFinalResult = (text) => this.onFinalResult?.(text);
      recognizer.onNotice = (message) => this.onNotice?.(message);
      recognizer.onError = (message) => {
        this.shouldListen = false;
        if (!this.stopRecognizer()) return;
        this.setError(message);
      };
      recognizer.onEnd = (shouldRestart = true) => {
        this.recognitionActive = false;
        if (!this.shouldListen || this.disposed) return;
        if (!shouldRestart) {
          this.shouldListen = false;
          this.setState("idle");
          return;
        }
        if (this.restartCount < MAX_RECOGNITION_RESTARTS) {
          try {
            this.restartCount += 1;
            recognizer.start();
            this.recognitionActive = true;
            this.setState("listening");
            return;
          } catch {
            this.shouldListen = false;
            this.setError(getRecognitionErrorMessage("recognition-stopped"));
            return;
          }
        }

        this.shouldListen = false;
        this.setError(getRecognitionErrorMessage("recognition-stopped"));
      };
    }

    if (synthesizer) {
      synthesizer.onStart = () => this.setState("speaking");
      synthesizer.onEnd = () => {
        if (this.currentState === "speaking" || this.currentState === "processing") {
          this.setState("idle");
        }
      };
      synthesizer.onBoundary = (charIndex) => this.onSpeechBoundary?.(charIndex);
    }
  }

  get state(): VoiceState {
    return this.currentState;
  }

  startListening(): void {
    if (this.disposed) return;
    if (!this.recognizer) {
      this.setError("Voice input is not available in this browser.");
      return;
    }
    if (this.recognitionActive && !this.stopRecognizer()) return;

    this.shouldListen = false;
    this.synthesizer?.cancel();
    this.restartCount = 0;
    this.shouldListen = true;
    this.setState("listening");
    try {
      this.recognizer.start();
      this.recognitionActive = true;
    } catch {
      this.shouldListen = false;
      this.setError("Microphone could not be started. Check permissions and try again.");
    }
  }

  stopListening(): void {
    this.shouldListen = false;
    if (this.currentState === "listening") {
      if (!this.stopRecognizer()) return;
      this.setState("idle");
    }
  }

  beginProcessing(): void {
    if (this.currentState === "listening") this.stopListening();
    if (this.currentState !== "error") this.setState("processing");
  }

  finishProcessing(): void {
    if (this.currentState === "processing") this.setState("idle");
  }

  speak(text: string): void {
    if (this.disposed) return;
    this.shouldListen = false;
    if ((this.recognitionActive || this.currentState === "listening") && !this.stopRecognizer()) {
      return;
    }
    this.synthesizer?.cancel();

    const cleanText = sanitizeSpeechText(text);
    if (!this.synthesizer || !cleanText) {
      this.setState("idle");
      return;
    }

    this.setState("processing");
    try {
      this.synthesizer.speak(cleanText);
    } catch {
      this.setError("AI voice could not start. You can continue reading the question.");
    }
  }

  cancelSpeech(): void {
    this.synthesizer?.cancel();
    if (this.currentState === "speaking" || this.currentState === "processing") {
      this.setState("idle");
    }
  }

  setRate(rate: number): void {
    this.synthesizer?.setRate(rate);
  }

  stop(): void {
    this.shouldListen = false;
    const stopped = !this.recognitionActive && this.currentState !== "listening"
      ? true
      : this.stopRecognizer();
    this.synthesizer?.cancel();
    if (stopped) this.setState("idle");
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    if (this.recognizer) {
      this.recognizer.onInterimResult = null;
      this.recognizer.onFinalResult = null;
      this.recognizer.onError = null;
      this.recognizer.onNotice = null;
      this.recognizer.onEnd = null;
    }
    if (this.synthesizer) {
      this.synthesizer.onStart = null;
      this.synthesizer.onEnd = null;
      this.synthesizer.onBoundary = null;
    }
  }

  private setState(state: VoiceState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.onStateChange?.(state);
  }

  private stopRecognizer(): boolean {
    if (!this.recognitionActive) return true;
    try {
      this.recognizer?.stop();
      this.recognitionActive = false;
      return true;
    } catch {
      this.setError("Microphone could not be stopped. Close the page before playing AI voice.");
      return false;
    }
  }

  private setError(message: string): void {
    this.currentState = "error";
    this.onError?.(message);
    this.onStateChange?.("error");
  }
}
