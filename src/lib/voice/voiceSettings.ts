/**
 * Locally persisted voice-mode preferences (auto-send, silence delay, speed).
 * Storage access is wrapped in try/catch so private-mode browsers degrade to
 * defaults instead of throwing.
 */

export interface VoiceSettings {
  autoSend: boolean;
  silenceDelayMs: number;
  voiceRate: number;
}

export const AUTO_SEND_DEFAULT = true;
export const SILENCE_DELAY_MIN_MS = 4000;
export const SILENCE_DELAY_MAX_MS = 5000;
export const SILENCE_DELAY_DEFAULT_MS = 4500;
export const VOICE_RATE_MIN = 0.8;
export const VOICE_RATE_MAX = 1.4;
export const VOICE_RATE_DEFAULT = 1;

export const VOICE_SETTINGS_STORAGE_KEY = "interviewiq-voice-settings";

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  autoSend: AUTO_SEND_DEFAULT,
  silenceDelayMs: SILENCE_DELAY_DEFAULT_MS,
  voiceRate: VOICE_RATE_DEFAULT,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Coerces unknown/partial data into a valid, clamped settings object. */
export function normalizeVoiceSettings(value: unknown): VoiceSettings {
  const raw = typeof value === "object" && value !== null ? (value as Partial<VoiceSettings>) : {};
  return {
    autoSend: typeof raw.autoSend === "boolean" ? raw.autoSend : AUTO_SEND_DEFAULT,
    silenceDelayMs: clampNumber(
      raw.silenceDelayMs,
      SILENCE_DELAY_MIN_MS,
      SILENCE_DELAY_MAX_MS,
      SILENCE_DELAY_DEFAULT_MS,
    ),
    voiceRate: clampNumber(raw.voiceRate, VOICE_RATE_MIN, VOICE_RATE_MAX, VOICE_RATE_DEFAULT),
  };
}

export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_SETTINGS };
  try {
    const stored = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_VOICE_SETTINGS };
    return normalizeVoiceSettings(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      VOICE_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeVoiceSettings(settings)),
    );
  } catch {
    // Storage unavailable (private mode/quota) — preferences stay session-only.
  }
}
