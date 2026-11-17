export interface LipSyncEngine {
  readonly mouthOpenness: number;
  subscribe(listener: () => void): () => void;
  start(): void;
  boundary(charIndex: number): void;
  end(): void;
  cancel(): void;
}
