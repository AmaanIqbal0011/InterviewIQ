/**
 * Pure speech/silence classifier fed with microphone RMS samples.
 *
 * The first `NOISE_CALIBRATION_MS` of samples establish the ambient noise
 * floor so background hum never counts as speech. After calibration a sample
 * is "speech" when its RMS clears `max(noiseFloor * multiplier, MIN_RMS)`
 * (capped at `MAX_THRESHOLD`). Everything is driven by explicit timestamps so
 * tests can exercise it without real timers or audio.
 */

export const NOISE_CALIBRATION_MS = 500;
/** Sounds shorter than this are treated as coughs/clicks, not answers. */
export const MIN_SPEECH_MS = 600;
/** RMS floor below which nothing can count as speech, even in a quiet room. */
export const MIN_RMS = 0.015;
export const NOISE_FLOOR_MULTIPLIER = 1.7;
export const MAX_THRESHOLD = 0.1;

export type SilenceEvent =
  | { readonly type: "calibrated"; readonly threshold: number }
  | { readonly type: "speech_started"; readonly atMs: number }
  | {
      readonly type: "speech_ended";
      readonly atMs: number;
      readonly speechMs: number;
      readonly qualified: boolean;
    };

export class SilenceDetector {
  private calibrationStartMs: number | null = null;
  private noiseSum = 0;
  private noiseSamples = 0;
  private calibratedFlag = false;
  private speechActive = false;
  private speechStartedAtMs: number | null = null;
  private noiseFloorValue = 0;
  private thresholdValue = MIN_RMS;

  /** (Re)starts the noise-floor calibration window at `nowMs`. */
  reset(nowMs: number): void {
    this.calibrationStartMs = nowMs;
    this.noiseSum = 0;
    this.noiseSamples = 0;
    this.calibratedFlag = false;
    this.speechActive = false;
    this.speechStartedAtMs = null;
    this.noiseFloorValue = 0;
    this.thresholdValue = MIN_RMS;
  }

  /**
   * Feeds one RMS sample taken at `nowMs` and returns the transition it
   * caused, if any. Returns `null` while calibrating or when nothing changed.
   */
  observe(rms: number, nowMs: number): SilenceEvent | null {
    if (this.calibrationStartMs === null) this.reset(nowMs);
    const calibrationStartMs = this.calibrationStartMs ?? nowMs;

    if (!this.calibratedFlag) {
      if (nowMs - calibrationStartMs < NOISE_CALIBRATION_MS) {
        this.noiseSum += rms;
        this.noiseSamples += 1;
        return null;
      }
      const floor = this.noiseSamples > 0 ? this.noiseSum / this.noiseSamples : 0;
      this.noiseFloorValue = floor;
      this.thresholdValue = Math.min(
        MAX_THRESHOLD,
        Math.max(MIN_RMS, floor * NOISE_FLOOR_MULTIPLIER),
      );
      this.calibratedFlag = true;
      return { type: "calibrated", threshold: this.thresholdValue };
    }

    const isSpeech = rms >= this.thresholdValue;

    if (!this.speechActive && isSpeech) {
      this.speechActive = true;
      this.speechStartedAtMs = nowMs;
      return { type: "speech_started", atMs: nowMs };
    }

    if (this.speechActive && !isSpeech) {
      const startedAt = this.speechStartedAtMs ?? nowMs;
      const speechMs = nowMs - startedAt;
      const qualified = speechMs >= MIN_SPEECH_MS;
      this.speechActive = false;
      this.speechStartedAtMs = null;
      return { type: "speech_ended", atMs: nowMs, speechMs, qualified };
    }

    return null;
  }

  get isCalibrated(): boolean {
    return this.calibratedFlag;
  }

  get isSpeechActive(): boolean {
    return this.speechActive;
  }

  get noiseFloor(): number {
    return this.noiseFloorValue;
  }

  get threshold(): number {
    return this.thresholdValue;
  }
}
