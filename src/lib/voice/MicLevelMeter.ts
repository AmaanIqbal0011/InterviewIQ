import { VoiceCaptureError } from "./types";

export type MicLevelListener = (rms: number, nowMs: number) => void;

type AudioContextConstructor = new () => AudioContext;

export function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function mapCaptureError(error: unknown): VoiceCaptureError {
  if (error instanceof VoiceCaptureError) return error;
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new VoiceCaptureError("mic_permission");
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return new VoiceCaptureError("mic_not_found");
    default:
      return new VoiceCaptureError(
        "unknown",
        "We couldn't open your microphone. Close other apps using it, then try again.",
      );
  }
}

/**
 * Captures the microphone through the Web Audio API and reports a smoothed
 * RMS level (~60 fps) so the voice loop can tell speech from silence and the
 * UI can react to the real input level. Owns its stream (and, unless a shared
 * context is provided, its AudioContext); `dispose()` releases everything.
 */
export class MicLevelMeter {
  private audioContext: AudioContext | null = null;
  private ownsContext = false;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private floatBuffer: Float32Array<ArrayBuffer> | null = null;
  private byteBuffer: Uint8Array<ArrayBuffer> | null = null;
  private frameRequest: number | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private smoothedLevel = 0;
  private disposed = false;

  constructor(
    private readonly onLevel: MicLevelListener,
    private readonly sharedContext?: AudioContext,
  ) {}

  async start(): Promise<void> {
    if (this.disposed) {
      throw new VoiceCaptureError("unknown", "This voice session was already closed.");
    }
    const mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new VoiceCaptureError(
        "unknown",
        "Microphone capture needs a secure (HTTPS) page in this browser.",
      );
    }
    const AudioContextCtor = getAudioContextConstructor();
    if (!this.sharedContext && !AudioContextCtor) {
      throw new VoiceCaptureError("unknown", "Web Audio is not available in this browser.");
    }

    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      throw mapCaptureError(error);
    }

    this.stream = stream;
    try {
      let context: AudioContext;
      if (this.sharedContext) {
        context = this.sharedContext;
      } else {
        if (!AudioContextCtor) {
          throw new VoiceCaptureError("unknown", "Web Audio is not available in this browser.");
        }
        context = new AudioContextCtor();
      }
      this.audioContext = context;
      this.ownsContext = !this.sharedContext;
      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      // The meter applies its own EMA smoothing; the analyser stays raw.
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      this.source = source;
      this.analyser = analyser;
      if (typeof analyser.getFloatTimeDomainData === "function") {
        this.floatBuffer = new Float32Array(analyser.fftSize);
      } else {
        this.byteBuffer = new Uint8Array(analyser.fftSize);
      }
      this.startLoop();
    } catch (error) {
      this.dispose();
      throw mapCaptureError(error);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameRequest !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // Graph may already be torn down.
    }
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.source = null;
    this.analyser = null;
    if (this.ownsContext && this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame === "function") {
      this.frameRequest = requestAnimationFrame(this.sample);
    } else {
      this.fallbackTimer = setTimeout(this.sample, 50);
    }
  }

  private readonly sample = (): void => {
    this.frameRequest = null;
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.disposed || !this.analyser) return;
    this.readAndEmit();
    if (typeof requestAnimationFrame === "function") {
      this.frameRequest = requestAnimationFrame(this.sample);
    } else {
      this.fallbackTimer = setTimeout(this.sample, 50);
    }
  };

  private readAndEmit(): void {
    const analyser = this.analyser;
    if (!analyser) return;
    let rms = 0;
    if (this.floatBuffer) {
      const buffer = this.floatBuffer;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let index = 0; index < buffer.length; index += 1) {
        const sample = buffer[index];
        sum += sample * sample;
      }
      rms = Math.sqrt(sum / buffer.length);
    } else if (this.byteBuffer) {
      const buffer = this.byteBuffer;
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let index = 0; index < buffer.length; index += 1) {
        const value = (buffer[index] - 128) / 128;
        sum += value * value;
      }
      rms = Math.sqrt(sum / buffer.length);
    }
    // Light exponential smoothing so single jittery frames do not flap the
    // speech/silence state.
    this.smoothedLevel = this.smoothedLevel * 0.7 + rms * 0.3;
    this.onLevel(this.smoothedLevel, Date.now());
  }
}
