import type { SpeechSynthesizer } from "./types";

export class WebSpeechSynthesizer implements SpeechSynthesizer {
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;
  onBoundary: ((charIndex: number) => void) | null = null;

  private rate = 1;

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

    if (!voice) {
      throw new Error("No local English speech voice is available.");
    }

    utterance.lang = "en-US";
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = this.rate;
    utterance.onstart = () => this.onStart?.();
    utterance.onend = () => this.onEnd?.();
    utterance.onboundary = (event) => this.onBoundary?.(event.charIndex);
    this.synthesis.speak(utterance);
  }

  cancel(): void {
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
