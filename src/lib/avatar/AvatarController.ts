import type { VoiceState } from "@/lib/voice/types";
import type { LipSyncEngine } from "./LipSyncEngine";
import type { AvatarSnapshot, AvatarState, AvatarVoiceEvents } from "./types";

const INITIAL_SNAPSHOT: AvatarSnapshot = {
  state: "idle",
  mouthOpenness: 0,
};

export class AvatarController {
  private snapshot = INITIAL_SNAPSHOT;
  private voiceState: VoiceState = "idle";
  private waitingForResponse = false;
  private enabled = true;
  private readonly listeners = new Set<() => void>();
  private readonly disconnectors: Array<() => void> = [];

  constructor(
    private readonly voiceEvents: AvatarVoiceEvents,
    private readonly lipSync: LipSyncEngine,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AvatarSnapshot => this.snapshot;

  getServerSnapshot = (): AvatarSnapshot => INITIAL_SNAPSHOT;

  connect(): void {
    if (this.disconnectors.length > 0) return;
    this.disconnectors.push(
      this.lipSync.subscribe(() => {
        this.publish({ ...this.snapshot, mouthOpenness: this.lipSync.mouthOpenness });
      }),
      this.voiceEvents.subscribeState((state) => this.updateVoiceState(state)),
      this.voiceEvents.subscribeSpeechBoundary((charIndex) => this.lipSync.boundary(charIndex)),
    );
  }

  disconnect(): void {
    this.disconnectors.splice(0).forEach((disconnect) => disconnect());
    this.lipSync.end();
    this.voiceState = "idle";
    this.waitingForResponse = false;
    if (this.snapshot.state !== "idle" || this.snapshot.mouthOpenness !== 0) {
      this.publish({ state: "idle", mouthOpenness: 0 });
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.lipSync.end();
    else if (this.snapshot.state === "speaking") this.lipSync.start();
  }

  setWaitingForResponse(waiting: boolean): void {
    if (this.waitingForResponse === waiting) return;
    this.waitingForResponse = waiting;
    this.updateState(this.deriveState());
  }

  private updateVoiceState(state: VoiceState): void {
    this.voiceState = state;
    const nextState = this.deriveState();
    if (this.snapshot.state !== "speaking" && nextState === "speaking" && this.enabled) {
      this.lipSync.start();
    } else if (this.snapshot.state === "speaking" && nextState !== "speaking") {
      this.lipSync.end();
    }
    this.updateState(nextState);
  }

  private deriveState(): AvatarState {
    if (this.voiceState === "listening") return "listening";
    if (this.voiceState === "speaking") return "speaking";
    if (this.waitingForResponse || this.voiceState === "processing") return "thinking";
    return "idle";
  }

  private updateState(state: AvatarState): void {
    if (this.snapshot.state === state) return;
    this.publish({ ...this.snapshot, state });
  }

  private publish(snapshot: AvatarSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
