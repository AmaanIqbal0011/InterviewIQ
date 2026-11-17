import type { LipSyncEngine } from "./LipSyncEngine";

const FRAME_INTERVAL_MS = 40;
const TARGET_INTERVAL_MS = 190;

export class WebSpeechLipSync implements LipSyncEngine {
  private openness = 0;
  private targetOpenness = 0;
  private speaking = false;
  private animationTimer: ReturnType<typeof setInterval> | null = null;
  private targetTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly random: () => number = Math.random) {}

  get mouthOpenness(): number {
    return this.openness;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.speaking) return;
    this.speaking = true;
    this.targetOpenness = this.nextCycleTarget();
    this.targetTimer = setInterval(() => {
      this.targetOpenness = this.nextCycleTarget();
    }, TARGET_INTERVAL_MS);
    this.animationTimer = setInterval(() => {
      const difference = this.targetOpenness - this.openness;
      this.setOpenness(this.openness + difference * 0.4);
    }, FRAME_INTERVAL_MS);
  }

  boundary(charIndex: number): void {
    if (!this.speaking) return;
    const wordAccent = (Math.abs(charIndex) % 4) * 0.02;
    this.targetOpenness = this.clamp(0.28 + this.random() * 0.65 + wordAccent);
    this.setOpenness(this.targetOpenness);
  }

  end(): void {
    this.speaking = false;
    if (this.animationTimer !== null) clearInterval(this.animationTimer);
    if (this.targetTimer !== null) clearInterval(this.targetTimer);
    this.animationTimer = null;
    this.targetTimer = null;
    this.targetOpenness = 0;
    this.setOpenness(0);
  }

  cancel(): void {
    this.end();
  }

  private nextCycleTarget(): number {
    if (this.random() < 0.25) return this.clamp(this.random() * 0.18);
    return this.clamp(0.22 + this.random() * 0.78);
  }

  private setOpenness(value: number): void {
    const next = this.clamp(value);
    if (next === this.openness) return;
    this.openness = next;
    this.listeners.forEach((listener) => listener());
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
