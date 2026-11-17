import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSpeechLipSync } from "@/lib/avatar/WebSpeechLipSync";

describe("WebSpeechLipSync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps mouth openness within range and resets immediately on end and cancel", () => {
    vi.useFakeTimers();
    const lipSync = new WebSpeechLipSync(() => 0.5);
    lipSync.start();
    lipSync.boundary(0);
    expect(lipSync.mouthOpenness).toBeGreaterThan(0);
    expect(lipSync.mouthOpenness).toBeLessThanOrEqual(1);

    vi.advanceTimersByTime(1000);
    expect(lipSync.mouthOpenness).toBeGreaterThanOrEqual(0);
    expect(lipSync.mouthOpenness).toBeLessThanOrEqual(1);
    lipSync.end();
    expect(lipSync.mouthOpenness).toBe(0);

    lipSync.start();
    lipSync.boundary(4);
    lipSync.cancel();
    expect(lipSync.mouthOpenness).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
