import { Capacitor } from "@capacitor/core";
import {
  Haptics,
  ImpactStyle,
  type HapticsPlugin,
} from "@capacitor/haptics";
import type { FeedbackResult } from "./foreground-rest-alert";

export interface TapSoundAdapter {
  tap(): Promise<FeedbackResult>;
}

export interface TapHapticsAdapter {
  tap(): Promise<FeedbackResult>;
}

export interface InteractionFeedbackResult {
  sound: FeedbackResult;
  haptics: FeedbackResult;
}

export interface InteractionFeedbackPlayer {
  playTap(): Promise<InteractionFeedbackResult>;
}

export class InteractionFeedback implements InteractionFeedbackPlayer {
  constructor(
    private readonly sound: TapSoundAdapter,
    private readonly haptics: TapHapticsAdapter,
  ) {}

  async playTap(): Promise<InteractionFeedbackResult> {
    const [sound, haptics] = await Promise.all([
      containFeedbackFailure(() => this.sound.tap()),
      containFeedbackFailure(() => this.haptics.tap()),
    ]);
    return { sound, haptics };
  }
}

export class WebAudioTapAdapter implements TapSoundAdapter {
  private context: AudioContext | null = null;

  constructor(
    private readonly createAudioContext: () => AudioContext | null =
      defaultAudioContextFactory,
  ) {}

  async tap(): Promise<FeedbackResult> {
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.createAudioContext();
      }
      if (!this.context) return "unsupported";
      if (this.context.state === "suspended") await this.context.resume();

      const startedAt = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(720, startedAt);
      gain.gain.setValueAtTime(0.045, startedAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.04);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(startedAt);
      oscillator.stop(startedAt + 0.04);
      return "played";
    } catch {
      return "failed";
    }
  }
}

export interface TapHapticsPlatformBridge {
  isNativePlatform(): boolean;
}

export type TapHapticsBridge = Pick<HapticsPlugin, "impact">;

export class CapacitorTapHapticsAdapter implements TapHapticsAdapter {
  constructor(
    private readonly platform: TapHapticsPlatformBridge = Capacitor,
    private readonly haptics: TapHapticsBridge = Haptics,
    private readonly browserVibrate: (duration: number) => boolean =
      defaultBrowserVibrate,
  ) {}

  async tap(): Promise<FeedbackResult> {
    try {
      if (this.platform.isNativePlatform()) {
        await this.haptics.impact({ style: ImpactStyle.Light });
        return "played";
      }
      return this.browserVibrate(12) ? "played" : "unsupported";
    } catch {
      return "failed";
    }
  }
}

export const defaultInteractionFeedback: InteractionFeedbackPlayer =
  new InteractionFeedback(
    new WebAudioTapAdapter(),
    new CapacitorTapHapticsAdapter(),
  );

async function containFeedbackFailure(
  feedback: () => Promise<FeedbackResult>,
): Promise<FeedbackResult> {
  try {
    return await feedback();
  } catch {
    return "failed";
  }
}

function defaultAudioContextFactory(): AudioContext | null {
  const audioGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    globalThis.AudioContext ?? audioGlobal.webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function defaultBrowserVibrate(duration: number): boolean {
  if (typeof globalThis.navigator?.vibrate !== "function") return false;
  return globalThis.navigator.vibrate(duration);
}
