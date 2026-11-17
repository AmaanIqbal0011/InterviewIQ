export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface SpeechRecognizer {
  onInterimResult: ((text: string) => void) | null;
  onFinalResult: ((text: string) => void) | null;
  onError: ((message: string) => void) | null;
  onNotice: ((message: string) => void) | null;
  onEnd: ((shouldRestart?: boolean) => void) | null;
  start(): void;
  stop(): void;
}

export interface SpeechSynthesizer {
  onStart: (() => void) | null;
  onEnd: (() => void) | null;
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
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
