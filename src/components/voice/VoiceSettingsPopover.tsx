"use client";

import { useEffect, useRef } from "react";
import { Settings2 } from "lucide-react";
import {
  SILENCE_DELAY_MAX_MS,
  SILENCE_DELAY_MIN_MS,
  VOICE_RATE_MAX,
  VOICE_RATE_MIN,
} from "@/lib/voice/voiceSettings";
import type { VoiceSettings } from "@/lib/voice/voiceSettings";

export interface VoiceSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: VoiceSettings;
  onChange: (patch: Partial<VoiceSettings>) => void;
}

/**
 * Small popover for the persisted voice preferences: auto-send toggle,
 * silence delay (4–5 s) and interviewer voice speed. Values are saved by the
 * parent hook to localStorage.
 */
export function VoiceSettingsPopover({
  open,
  onOpenChange,
  settings,
  onChange,
}: VoiceSettingsPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Voice settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
          open
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border bg-surface text-muted-foreground hover:bg-surface-strong hover:text-foreground"
        }`}
      >
        <Settings2 aria-hidden="true" className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Voice settings"
          className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="voice-auto-send"
              className="min-w-0 text-sm font-medium text-foreground"
            >
              Auto-send after silence
            </label>
            <button
              id="voice-auto-send"
              type="button"
              role="switch"
              aria-checked={settings.autoSend}
              onClick={() => onChange({ autoSend: !settings.autoSend })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings.autoSend ? "bg-accent" : "bg-surface-strong"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  settings.autoSend ? "left-[22px]" : "left-0.5"
                }`}
              />
              <span className="sr-only">{settings.autoSend ? "On" : "Off"}</span>
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="voice-silence-delay" className="text-sm text-muted-foreground">
                Silence before send
              </label>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {(settings.silenceDelayMs / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              id="voice-silence-delay"
              type="range"
              min={SILENCE_DELAY_MIN_MS}
              max={SILENCE_DELAY_MAX_MS}
              step={100}
              value={settings.silenceDelayMs}
              disabled={!settings.autoSend}
              onChange={(event) => onChange({ silenceDelayMs: Number(event.target.value) })}
              className="mt-2 w-full accent-[var(--accent)] disabled:opacity-50"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="voice-speed" className="text-sm text-muted-foreground">
                Voice speed
              </label>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {settings.voiceRate.toFixed(1)}x
              </span>
            </div>
            <input
              id="voice-speed"
              type="range"
              min={VOICE_RATE_MIN}
              max={VOICE_RATE_MAX}
              step={0.1}
              value={settings.voiceRate}
              onChange={(event) => onChange({ voiceRate: Number(event.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Preferences are saved on this device.
          </p>
        </div>
      )}
    </div>
  );
}
