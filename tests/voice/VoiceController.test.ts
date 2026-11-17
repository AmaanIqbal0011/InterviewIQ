import { describe, expect, it, vi } from "vitest";
import { sanitizeSpeechText, VoiceController } from "@/lib/voice/VoiceController";
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_FALLBACK_NOTE,
  getRecognitionErrorMessage,
  WebSpeechRecognizer,
} from "@/lib/voice/WebSpeechRecognizer";
import { WebSpeechSynthesizer } from "@/lib/voice/WebSpeechSynthesizer";
import type {
  SpeechRecognitionErrorEvent,
  SpeechRecognitionInstance,
  SpeechRecognitionResultEvent,
  SpeechRecognizer,
  SpeechRecognitionConstructor,
  SpeechSynthesizer,
  VoiceState,
} from "@/lib/voice/types";

class MockRecognizer implements SpeechRecognizer {
  onInterimResult: ((text: string) => void) | null = null;
  onFinalResult: ((text: string) => void) | null = null;
  onError: ((message: string) => void) | null = null;
  onNotice: ((message: string) => void) | null = null;
  onEnd: (() => void) | null = null;
  active = false;
  starts = 0;
  stops = 0;

  start(): void {
    this.active = true;
    this.starts += 1;
  }

  stop(): void {
    this.active = false;
    this.stops += 1;
  }
}

class MockSynthesizer implements SpeechSynthesizer {
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;
  onBoundary: ((charIndex: number) => void) | null = null;
  spoken: string[] = [];
  cancel = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  setRate = vi.fn();

  speak(text: string): void {
    this.spoken.push(text);
    this.onStart?.();
  }
}

class MockBrowserRecognition implements SpeechRecognitionInstance {
  continuous = false;
  interimResults = false;
  lang = "";
  processLocally = false;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

describe("VoiceController", () => {
  it("transitions between listening, processing, speaking, and idle", () => {
    const recognizer = new MockRecognizer();
    const synthesizer = new MockSynthesizer();
    const controller = new VoiceController(recognizer, synthesizer);
    const states: VoiceState[] = [];
    controller.onStateChange = (state) => states.push(state);

    controller.startListening();
    controller.beginProcessing();
    controller.speak("Next question");
    synthesizer.onEnd?.();

    expect(states).toEqual(["listening", "idle", "processing", "speaking", "idle"]);
  });

  it("stops recognition before speaking", () => {
    const recognizer = new MockRecognizer();
    const synthesizer = new MockSynthesizer();
    const controller = new VoiceController(recognizer, synthesizer);

    controller.startListening();
    controller.speak("Question");

    expect(recognizer.active).toBe(false);
    expect(recognizer.stops).toBe(1);
    expect(synthesizer.spoken).toEqual(["Question"]);

    synthesizer.cancel.mockClear();
    controller.startListening();
    expect(synthesizer.cancel).toHaveBeenCalledOnce();
  });

  it("cancels speech and stops listening when disposed", () => {
    const recognizer = new MockRecognizer();
    const synthesizer = new MockSynthesizer();
    const controller = new VoiceController(recognizer, synthesizer);

    controller.startListening();
    synthesizer.cancel.mockClear();
    controller.dispose();

    expect(recognizer.active).toBe(false);
    expect(recognizer.stops).toBe(1);
    expect(synthesizer.cancel).toHaveBeenCalledOnce();
    expect(controller.state).toBe("idle");
  });

  it("falls back when on-device speech recognition is unavailable", () => {
    expect(WebSpeechRecognizer.create("en-US", undefined)).toBeNull();
  });

  it("uses the prefixed recognizer with continuous interim results and preserves cloud default", () => {
    const instances: MockBrowserRecognition[] = [];
    const Recognition: SpeechRecognitionConstructor = class extends MockBrowserRecognition {
      constructor() {
        super();
        instances.push(this);
      }
    };
    const browserWindow = {
      webkitSpeechRecognition: Recognition,
    } as unknown as Window;
    const recognizer = WebSpeechRecognizer.create("hi-IN", browserWindow);
    const browserRecognition = instances[0];
    const interimResult = vi.fn();
    const finalResult = vi.fn();
    if (recognizer) {
      recognizer.onInterimResult = interimResult;
      recognizer.onFinalResult = finalResult;
    }

    expect(browserRecognition?.processLocally).toBe(false);
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

  it("retries an unsupported language once with en-US without reporting a hard error", () => {
    const instances: MockBrowserRecognition[] = [];
    const Recognition: SpeechRecognitionConstructor = class extends MockBrowserRecognition {
      constructor() {
        super();
        instances.push(this);
      }
    };
    const browserWindow = {
      SpeechRecognition: Recognition,
    } as unknown as Window;
    const recognizer = WebSpeechRecognizer.create("ur-PK", browserWindow);
    const nativeRecognition = instances[0];
    const controller = new VoiceController(recognizer, null);
    const errors = vi.fn();
    const notices = vi.fn();
    controller.onError = errors;
    controller.onNotice = notices;

    controller.startListening();
    nativeRecognition?.onerror?.(
      Object.assign(new Event("error"), { error: "language-not-supported" }),
    );
    nativeRecognition?.onend?.();

    expect(nativeRecognition?.lang).toBe(FALLBACK_LANGUAGE);
    expect(nativeRecognition?.start).toHaveBeenCalledTimes(2);
    expect(controller.state).toBe("listening");
    expect(errors).not.toHaveBeenCalled();
    expect(notices).toHaveBeenCalledOnce();
    expect(notices).toHaveBeenLastCalledWith(LANGUAGE_FALLBACK_NOTE);

    nativeRecognition?.onerror?.(
      Object.assign(new Event("error"), { error: "language-not-supported" }),
    );
    nativeRecognition?.onend?.();

    expect(nativeRecognition?.start).toHaveBeenCalledTimes(2);
    expect(controller.state).toBe("idle");
    expect(errors).not.toHaveBeenCalled();
    expect(notices).toHaveBeenCalledOnce();
    expect(notices).toHaveBeenLastCalledWith(LANGUAGE_FALLBACK_NOTE);
  });

  it("maps recognition errors to specific friendly messages", () => {
    expect(getRecognitionErrorMessage("not-allowed")).toBe(
      "Microphone permission is blocked. Allow it in the browser's site settings.",
    );
    expect(getRecognitionErrorMessage("no-speech")).toBe("I didn't hear anything. Try again.");
    expect(getRecognitionErrorMessage("network")).toBe(
      "Voice recognition needs an internet connection.",
    );
    expect(getRecognitionErrorMessage("audio-capture")).toBe("No microphone found.");
  });

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

  it("restarts recognition after unexpected stops, with a bounded retry count", () => {
    const recognizer = new MockRecognizer();
    const controller = new VoiceController(recognizer, null);
    const states: VoiceState[] = [];
    controller.onStateChange = (state) => states.push(state);
    controller.startListening();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      recognizer.active = false;
      recognizer.onEnd?.();
    }

    expect(recognizer.starts).toBe(4);
    expect(controller.state).toBe("error");
    expect(states[states.length - 1]).toBe("error");
  });

  it("removes markdown and symbols before speech", () => {
    const recognizer = new MockRecognizer();
    const synthesizer = new MockSynthesizer();
    const controller = new VoiceController(recognizer, synthesizer);

    controller.speak("## **Tell me** [about](https://example.test) `projects` 🚀");

    expect(synthesizer.spoken).toEqual(["Tell me about projects"]);
    expect(sanitizeSpeechText("> - What is your experience?")).toBe("What is your experience?");
  });
});
