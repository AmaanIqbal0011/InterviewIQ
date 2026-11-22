import type { SpeechSynthesizer } from "./types";

/**
 * Strips markdown/symbols from a question before it is spoken so the TTS
 * never reads raw markup aloud.
 */
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

export class WebSpeechSynthesizer implements SpeechSynthesizer {
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;
  onError: (() => void) | null = null;
  onBoundary: ((charIndex: number) => void) | null = null;

  private rate = 1;
  /** Identity check so events from a cancelled utterance are ignored. */
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private readonly synthesis: SpeechSynthesis,
    private readonly createUtterance: (text: string) => SpeechSynthesisUtterance,
  ) {}

  speak(text: string): void {
    const utterance = this.createUtterance(text);
    const englishVoices = this.synthesis
      .getVoices()
      .filter((voice) => voice.localService && voice.lang.toLowerCase().startsWith("en"));
    const voice =
      englishVoices.find((candidate) => candidate.default) ??
      englishVoices.find((candidate) => candidate.lang.toLowerCase() === "en-us") ??
      englishVoices[0];

    utterance.lang = "en-US";
    if (voice) {
      // Prefer a local English voice, but fall back to the browser default
      // voice rather than failing: some browsers return an empty voice list
      // until the first utterance has been synthesised.
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = this.rate;

    utterance.onstart = () => {
      if (this.activeUtterance === utterance) this.onStart?.();
    };
    utterance.onend = () => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.onEnd?.();
    };
    utterance.onerror = () => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.onError?.();
    };
    utterance.onboundary = (event) => {
      if (this.activeUtterance === utterance) this.onBoundary?.(event.charIndex);
    };

    this.activeUtterance = utterance;
    this.synthesis.speak(utterance);
  }

  cancel(): void {
    this.activeUtterance = null;
    this.synthesis.cancel();
  }

  pause(): void {
    this.synthesis.pause();
  }

  resume(): void {
    this.synthesis.resume();
  }

  setRate(rate: number): void {
    this.rate = Math.min(2, Math.max(0.5, rate));
  }
}
