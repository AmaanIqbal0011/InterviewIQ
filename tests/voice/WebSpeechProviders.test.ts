import { describe, expect, it, vi } from "vitest";
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_FALLBACK_NOTE,
  findSpeechRecognitionConstructor,
  getRecognitionErrorMessage,
  getRecognitionErrorReason,
  WebSpeechRecognizer,
} from "@/lib/voice/WebSpeechRecognizer";
import { sanitizeSpeechText, WebSpeechSynthesizer } from "@/lib/voice/WebSpeechSynthesizer";
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionInstance,
  SpeechRecognitionResultEvent,
} from "@/lib/voice/types";

class MockBrowserRecognition implements SpeechRecognitionInstance {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

function createWithConstructor(
  key: "SpeechRecognition" | "webkitSpeechRecognition",
  instances: MockBrowserRecognition[],
): Window {
  const Recognition: SpeechRecognitionConstructor = class extends MockBrowserRecognition {
    constructor() {
      super();
      instances.push(this);
    }
  };
  return { [key]: Recognition } as unknown as Window;
}

describe("WebSpeechRecognizer", () => {
  it("returns null when speech recognition is unavailable", () => {
    expect(WebSpeechRecognizer.create("en-US", undefined)).toBeNull();
    expect(findSpeechRecognitionConstructor(undefined)).toBeNull();
    expect(findSpeechRecognitionConstructor({} as Window)).toBeNull();
  });

  it("uses the prefixed recognizer with continuous interim results", () => {
    const instances: MockBrowserRecognition[] = [];
    const browserWindow = createWithConstructor("webkitSpeechRecognition", instances);
    const recognizer = WebSpeechRecognizer.create("hi-IN", browserWindow);
    const browserRecognition = instances[0];
    const interimResult = vi.fn();
    const finalResult = vi.fn();
    expect(recognizer).not.toBeNull();
    if (!recognizer) return;
    recognizer.onInterimResult = interimResult;
    recognizer.onFinalResult = finalResult;

    expect(browserRecognition?.continuous).toBe(true);
    expect(browserRecognition?.interimResults).toBe(true);
    expect(browserRecognition?.lang).toBe("hi-IN");

    const results = [
      { 0: { transcript: "hello" }, isFinal: true, length: 1 },
      { 0: { transcript: "world" }, isFinal: false, length: 1 },
    ] as unknown as SpeechRecognitionResultList;
    browserRecognition?.onresult?.(
      Object.assign(new Event("result"), { resultIndex: 0, results }),
    );
    expect(finalResult).toHaveBeenCalledWith("hello");
    expect(interimResult).toHaveBeenCalledWith("world");
  });

  it("retries an unsupported language once with en-US and surfaces a notice", () => {
    const instances: MockBrowserRecognition[] = [];
    const browserWindow = createWithConstructor("SpeechRecognition", instances);
    const recognizer = WebSpeechRecognizer.create("ur-PK", browserWindow);
    const nativeRecognition = instances[0];
    expect(recognizer).not.toBeNull();
    if (!recognizer) return;
    const errors = vi.fn();
    const notices = vi.fn();
    const ends: Array<boolean | undefined> = [];
    recognizer.onError = errors;
    recognizer.onNotice = notices;
    recognizer.onEnd = (shouldRestart) => ends.push(shouldRestart);

    nativeRecognition?.onerror?.(
      Object.assign(new Event("error"), { error: "language-not-supported" }),
    );
    expect(nativeRecognition?.lang).toBe(FALLBACK_LANGUAGE);
    expect(notices).toHaveBeenCalledOnce();
    expect(notices).toHaveBeenLastCalledWith(LANGUAGE_FALLBACK_NOTE);
    expect(errors).not.toHaveBeenCalled();

    // The engine ends after the fallback switch: a restart is requested.
    nativeRecognition?.onend?.();
    expect(ends).toEqual([true]);

    // A second failure stops the engine for good instead of looping.
    nativeRecognition?.onerror?.(
      Object.assign(new Event("error"), { error: "language-not-supported" }),
    );
    nativeRecognition?.onend?.();
    expect(nativeRecognition?.start).not.toHaveBeenCalled();
    expect(ends).toEqual([true, false]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("maps recognition errors to specific friendly messages with codes", () => {
    expect(getRecognitionErrorMessage("not-allowed")).toBe(
      "Microphone permission is blocked. Allow it in the browser's site settings.",
    );
    expect(getRecognitionErrorMessage("no-speech")).toBe("I didn't hear anything. Try again.");
    expect(getRecognitionErrorMessage("network")).toBe(
      "Voice recognition needs an internet connection.",
    );
    expect(getRecognitionErrorMessage("audio-capture")).toBe("No microphone found.");

    const instances: MockBrowserRecognition[] = [];
    const browserWindow = createWithConstructor("SpeechRecognition", instances);
    const recognizer = WebSpeechRecognizer.create("en-US", browserWindow);
    expect(recognizer).not.toBeNull();
    if (!recognizer) return;
    const errors: Array<{ message: string; code?: string }> = [];
    recognizer.onError = (message, code) => errors.push({ message, code });

    instances[0]?.onerror?.(Object.assign(new Event("error"), { error: "not-allowed" }));
    expect(errors).toEqual([
      {
        message: "Microphone permission is blocked. Allow it in the browser's site settings.",
        code: "not-allowed",
      },
    ]);
  });

  it("maps only hard failures to typed loop reasons", () => {
    expect(getRecognitionErrorReason("not-allowed")).toBe("mic_permission");
    expect(getRecognitionErrorReason("service-not-allowed")).toBe("mic_permission");
    expect(getRecognitionErrorReason("audio-capture")).toBe("mic_not_found");
    expect(getRecognitionErrorReason("no-speech")).toBeNull();
    expect(getRecognitionErrorReason("aborted")).toBeNull();
    expect(getRecognitionErrorReason("network")).toBeNull();
    expect(getRecognitionErrorReason(undefined)).toBeNull();
  });

  it("does not request a restart after stop() or abort()", () => {
    const instances: MockBrowserRecognition[] = [];
    const browserWindow = createWithConstructor("SpeechRecognition", instances);
    const recognizer = WebSpeechRecognizer.create("en-US", browserWindow);
    expect(recognizer).not.toBeNull();
    if (!recognizer) return;
    const ends: Array<boolean | undefined> = [];
    recognizer.onEnd = (shouldRestart) => ends.push(shouldRestart);

    recognizer.start();
    instances[0]?.onend?.();
    expect(ends).toEqual([true]);

    recognizer.stop();
    instances[0]?.onend?.();
    expect(ends).toEqual([true, false]);

    // start() re-arms restarts after a deliberate stop.
    recognizer.start();
    instances[0]?.onend?.();
    expect(ends).toEqual([true, false, true]);

    recognizer.abort();
    instances[0]?.onend?.();
    expect(ends).toEqual([true, false, true, false]);
    expect(instances[0]?.abort).toHaveBeenCalledOnce();
  });
});

describe("WebSpeechSynthesizer", () => {
  it("chooses a local English synthesis voice and applies the selected speed", () => {
    const localVoice = {
      default: false,
      lang: "en-GB",
      localService: true,
    } as SpeechSynthesisVoice;
    const remoteVoice = {
      default: true,
      lang: "en-US",
      localService: false,
    } as SpeechSynthesisVoice;
    const utterance = {
      lang: "",
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
      onboundary: null,
    } as unknown as SpeechSynthesisUtterance;
    const speech = {
      getVoices: () => [remoteVoice, localVoice],
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    } as unknown as SpeechSynthesis;
    const synthesizer = new WebSpeechSynthesizer(speech, () => utterance);

    synthesizer.setRate(1.2);
    synthesizer.speak("Question");

    expect(utterance.voice).toBe(localVoice);
    expect(utterance.lang).toBe("en-GB");
    expect(utterance.rate).toBe(1.2);
    expect(speech.speak).toHaveBeenCalledWith(utterance);
  });

  it("falls back to the browser default voice when no voices are listed", () => {
    const utterance = {
      lang: "",
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
      onboundary: null,
    } as unknown as SpeechSynthesisUtterance;
    const speech = {
      getVoices: () => [],
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    } as unknown as SpeechSynthesis;
    const synthesizer = new WebSpeechSynthesizer(speech, () => utterance);

    expect(() => synthesizer.speak("Question")).not.toThrow();
    expect(utterance.voice).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith(utterance);
  });

  it("ignores lifecycle events from a cancelled utterance", () => {
    const voices = [
      { default: true, lang: "en-US", localService: true },
    ] as SpeechSynthesisVoice[];
    const utterances: Array<Record<string, unknown>> = [];
    const speech = {
      getVoices: () => voices,
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    } as unknown as SpeechSynthesis;
    const synthesizer = new WebSpeechSynthesizer(speech, (text) => {
      const utterance = { text, onstart: null, onend: null, onerror: null, onboundary: null };
      utterances.push(utterance);
      return utterance as unknown as SpeechSynthesisUtterance;
    });
    const onEnd = vi.fn();
    const onError = vi.fn();
    synthesizer.onEnd = onEnd;
    synthesizer.onError = onError;

    synthesizer.speak("First");
    synthesizer.speak("Second");
    synthesizer.cancel();

    // Stale events from the cancelled utterances must be dropped.
    (utterances[0]?.onend as () => void)();
    (utterances[1]?.onerror as () => void)();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    // A live utterance still reports normally.
    synthesizer.speak("Third");
    (utterances[2]?.onend as () => void)();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("sanitizeSpeechText", () => {
  it("removes markdown and symbols before speech", () => {
    expect(sanitizeSpeechText("## **Tell me** [about](https://example.test) `projects` 🚀")).toBe(
      "Tell me about projects",
    );
    expect(sanitizeSpeechText("> - What is your experience?")).toBe("What is your experience?");
    expect(sanitizeSpeechText("```code block``` answer")).toBe("answer");
  });
});
