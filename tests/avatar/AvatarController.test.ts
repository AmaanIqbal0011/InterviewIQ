import { describe, expect, it } from "vitest";
import { AvatarController } from "@/lib/avatar/AvatarController";
import type { LipSyncEngine } from "@/lib/avatar/LipSyncEngine";
import type { AvatarVoiceEvents } from "@/lib/avatar/types";
import type { VoiceState } from "@/lib/voice/types";

class MockAvatarVoiceEvents implements AvatarVoiceEvents {
  private readonly stateListeners = new Set<(state: VoiceState) => void>();
  private readonly boundaryListeners = new Set<(charIndex: number) => void>();
  private state: VoiceState = "idle";

  subscribeState(listener: (state: VoiceState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribeSpeechBoundary(listener: (charIndex: number) => void): () => void {
    this.boundaryListeners.add(listener);
    return () => this.boundaryListeners.delete(listener);
  }

  setState(state: VoiceState): void {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  emitBoundary(charIndex: number): void {
    this.boundaryListeners.forEach((listener) => listener(charIndex));
  }
}

class MockLipSyncEngine implements LipSyncEngine {
  mouthOpenness = 0;
  boundaries: number[] = [];
  starts = 0;
  ends = 0;

  subscribe(): () => void {
    return () => undefined;
  }

  start(): void {
    this.starts += 1;
  }

  boundary(charIndex: number): void {
    this.boundaries.push(charIndex);
  }

  end(): void {
    this.ends += 1;
  }

  cancel(): void {
    this.end();
  }
}

describe("AvatarController", () => {
  it("maps voice and chat events to every avatar state", () => {
    const voice = new MockAvatarVoiceEvents();
    const lipSync = new MockLipSyncEngine();
    const controller = new AvatarController(voice, lipSync);
    controller.connect();

    expect(controller.getSnapshot().state).toBe("idle");
    voice.setState("listening");
    expect(controller.getSnapshot().state).toBe("listening");
    voice.setState("processing");
    expect(controller.getSnapshot().state).toBe("thinking");
    voice.setState("speaking");
    expect(controller.getSnapshot().state).toBe("speaking");
    voice.emitBoundary(12);
    expect(lipSync.boundaries).toEqual([12]);
    voice.setState("idle");
    expect(controller.getSnapshot().state).toBe("idle");
    voice.setState("error");
    expect(controller.getSnapshot().state).toBe("idle");

    controller.setWaitingForResponse(true);
    expect(controller.getSnapshot().state).toBe("thinking");
    voice.setState("speaking");
    expect(controller.getSnapshot().state).toBe("speaking");
    controller.setWaitingForResponse(false);
    voice.setState("idle");
    expect(controller.getSnapshot().state).toBe("idle");
    expect(lipSync.starts).toBe(2);
    expect(lipSync.ends).toBe(2);
    controller.disconnect();
  });
});
