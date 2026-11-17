import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionInstance,
  SpeechRecognitionWindow,
  SpeechRecognizer,
} from "./types";

export const FALLBACK_LANGUAGE = "en-US";
export const LANGUAGE_FALLBACK_NOTE =
  "Voice recognition does not support this language here. Using English instead.";

export function getRecognitionErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is blocked. Allow it in the browser's site settings.";
    case "no-speech":
      return "I didn't hear anything. Try again.";
    case "network":
      return "Voice recognition needs an internet connection.";
    case "audio-capture":
      return "No microphone found.";
    case "language-not-supported":
      return LANGUAGE_FALLBACK_NOTE;
    default:
      return "Speech recognition failed. Try again or type your answer.";
  }
}

export function findSpeechRecognitionConstructor(
  target: Window | undefined,
): SpeechRecognitionConstructor | null {
  if (!target) return null;
  const speechWindow = target as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export class WebSpeechRecognizer implements SpeechRecognizer {
  onInterimResult: ((text: string) => void) | null = null;
  onFinalResult: ((text: string) => void) | null = null;
  onError: ((message: string) => void) | null = null;
  onNotice: ((message: string) => void) | null = null;
  onEnd: ((shouldRestart?: boolean) => void) | null = null;

  private fallbackAttempted = false;
  private stopAfterEnd = false;

  constructor(
    private readonly recognition: SpeechRecognitionInstance,
    language: string,
  ) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (finalText) this.onFinalResult?.(finalText);
      this.onInterimResult?.(interimText);
    };
    recognition.onerror = (event) => {
      if (event.error === "language-not-supported") {
        if (this.fallbackAttempted) {
          this.stopAfterEnd = true;
        } else {
          this.fallbackAttempted = true;
          recognition.lang = FALLBACK_LANGUAGE;
          this.onNotice?.(LANGUAGE_FALLBACK_NOTE);
        }
        return;
      }

      this.onError?.(getRecognitionErrorMessage(event.error));
    };
    recognition.onend = () => {
      const shouldRestart = !this.stopAfterEnd;
      this.stopAfterEnd = false;
      this.onEnd?.(shouldRestart);
    };
  }

  static create(
    language: string,
    target: Window | undefined = typeof window === "undefined" ? undefined : window,
  ): WebSpeechRecognizer | null {
    const Recognition = findSpeechRecognitionConstructor(target);
    if (!Recognition) return null;

    const recognition = new Recognition();
    return new WebSpeechRecognizer(recognition, language);
  }

  start(): void {
    this.recognition.start();
  }

  stop(): void {
    this.recognition.stop();
  }
}
