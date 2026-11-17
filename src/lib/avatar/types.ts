import type { VoiceState } from "@/lib/voice/types";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export interface AvatarSnapshot {
  state: AvatarState;
  mouthOpenness: number;
}

export interface AvatarVoiceEvents {
  subscribeState(listener: (state: VoiceState) => void): () => void;
  subscribeSpeechBoundary(listener: (charIndex: number) => void): () => void;
}
