import { describe, expect, it } from "vitest";
import {
  MAX_THRESHOLD,
  MIN_RMS,
  MIN_SPEECH_MS,
  NOISE_CALIBRATION_MS,
  NOISE_FLOOR_MULTIPLIER,
  SilenceDetector,
} from "@/lib/voice/SilenceDetector";

/** Feeds `count` samples spaced `stepMs` apart starting at `fromMs`. */
function feed(
  detector: SilenceDetector,
  rms: number,
  fromMs: number,
  count: number,
  stepMs = 50,
): number {
  let now = fromMs;
  for (let index = 0; index < count; index += 1) {
    detector.observe(rms, now);
    now += stepMs;
  }
  return now;
}

describe("SilenceDetector", () => {
  it("calibrates the noise floor during the first window", () => {
    const detector = new SilenceDetector();
    detector.reset(1_000);

    // Nothing happens inside the calibration window.
    expect(detector.observe(0.02, 1_100)).toBeNull();
    expect(detector.observe(0.04, 1_300)).toBeNull();
    expect(detector.isCalibrated).toBe(false);

    const event = detector.observe(0.04, 1_000 + NOISE_CALIBRATION_MS);
    expect(event).toEqual({
      type: "calibrated",
      threshold: Math.min(MAX_THRESHOLD, 0.03 * NOISE_FLOOR_MULTIPLIER),
    });
    expect(detector.isCalibrated).toBe(true);
    expect(detector.noiseFloor).toBeCloseTo(0.03);
  });

  it("never treats calibrated background noise as speech", () => {
    const detector = new SilenceDetector();
    detector.reset(0);
    const afterCalibration = feed(detector, 0.02, 0, 12); // 0..550ms

    // Steady hum right at the calibrated level keeps us quiet.
    for (let now = afterCalibration; now < afterCalibration + 5_000; now += 50) {
      expect(detector.observe(0.02, now)).toBeNull();
    }
    expect(detector.isSpeechActive).toBe(false);
  });

  it("detects a real utterance and reports its duration as qualified", () => {
    const detector = new SilenceDetector();
    detector.reset(0);
    const now = feed(detector, 0.01, 0, 12);

    expect(detector.observe(0.08, now)).toEqual({ type: "speech_started", atMs: now });
    expect(detector.isSpeechActive).toBe(true);

    const endMs = now + MIN_SPEECH_MS + 50;
    expect(detector.observe(0.01, endMs)).toEqual({
      type: "speech_ended",
      atMs: endMs,
      speechMs: MIN_SPEECH_MS + 50,
      qualified: true,
    });
    expect(detector.isSpeechActive).toBe(false);
  });

  it("marks short spikes like coughs as unqualified", () => {
    const detector = new SilenceDetector();
    detector.reset(0);
    const now = feed(detector, 0.01, 0, 12);

    detector.observe(0.09, now);
    const endMs = now + MIN_SPEECH_MS - 100;
    const event = detector.observe(0.01, endMs);

    expect(event).not.toBeNull();
    expect(event?.type).toBe("speech_ended");
    if (event?.type === "speech_ended") {
      expect(event.qualified).toBe(false);
      expect(event.speechMs).toBe(MIN_SPEECH_MS - 100);
    }
  });

  it("caps the threshold and keeps a minimum floor", () => {
    const loudDetector = new SilenceDetector();
    loudDetector.reset(0);
    feed(loudDetector, 0.4, 0, 10); // samples at 0..450ms, still calibrating
    const loudEvent = loudDetector.observe(0.4, NOISE_CALIBRATION_MS);
    expect(loudEvent).toEqual({ type: "calibrated", threshold: MAX_THRESHOLD });

    const silentDetector = new SilenceDetector();
    silentDetector.reset(0);
    feed(silentDetector, 0, 0, 10);
    const silentEvent = silentDetector.observe(0, NOISE_CALIBRATION_MS);
    expect(silentEvent).toEqual({ type: "calibrated", threshold: MIN_RMS });
  });

  it("self-calibrates on the first sample when reset was never called", () => {
    const detector = new SilenceDetector();
    expect(detector.observe(0.05, 0)).toBeNull();
    expect(detector.observe(0.05, NOISE_CALIBRATION_MS)).toEqual({
      type: "calibrated",
      threshold: Math.min(MAX_THRESHOLD, 0.05 * NOISE_FLOOR_MULTIPLIER),
    });
  });

  it("re-arms fully on reset so the next answer starts clean", () => {
    const detector = new SilenceDetector();
    detector.reset(0);
    const now = feed(detector, 0.01, 0, 12);
    detector.observe(0.08, now);
    expect(detector.isSpeechActive).toBe(true);

    detector.reset(10_000);
    expect(detector.isSpeechActive).toBe(false);
    expect(detector.isCalibrated).toBe(false);
    expect(detector.noiseFloor).toBe(0);
    expect(detector.observe(0.08, 10_100)).toBeNull();
  });
});
