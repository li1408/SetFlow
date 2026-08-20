import { Capacitor } from "@capacitor/core";
import {
  Haptics,
  NotificationType,
  type HapticsPlugin,
} from "@capacitor/haptics";

export type FeedbackResult = "played" | "unsupported" | "failed";

export interface BeepAdapter {
  beep(): Promise<FeedbackResult>;
}

export interface VibrationAdapter {
  vibrate(): Promise<FeedbackResult>;
}

export interface ForegroundRestAlertResult {
  beep: FeedbackResult;
  vibration: FeedbackResult;
}

export class ForegroundRestAlert {
  constructor(
    private readonly beeper: BeepAdapter,
    private readonly vibrator: VibrationAdapter,
  ) {}

  async notifyRestEnded(): Promise<ForegroundRestAlertResult> {
    const [beep, vibration] = await Promise.all([
      containFeedbackFailure(() => this.beeper.beep()),
      containFeedbackFailure(() => this.vibrator.vibrate()),
    ]);
    return { beep, vibration };
  }
}

export interface RestEndedNotifier {
  notifyRestEnded(): Promise<unknown>;
}

export class RepeatingForegroundRestAlert {
  private intervalId: number | undefined;

  constructor(
    private readonly notifier: RestEndedNotifier,
    private readonly intervalMilliseconds = 2_000,
  ) {}

  start(): void {
    if (this.intervalId !== undefined) return;
    this.notify();
    this.intervalId = window.setInterval(
      () => this.notify(),
      this.intervalMilliseconds,
    );
  }

  stop(): void {
    if (this.intervalId === undefined) return;
    window.clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  private notify(): void {
    void this.notifier.notifyRestEnded().catch(() => undefined);
  }
}

export class WebAudioBeepAdapter implements BeepAdapter {
  constructor(
    private readonly createAudioContext: () => AudioContext | null =
      defaultAudioContextFactory,
  ) {}

  async beep(): Promise<FeedbackResult> {
    let context: AudioContext | null = null;
    try {
      context = this.createAudioContext();
      if (!context) return "unsupported";
      if (context.state === "suspended") await context.resume();

      const startedAt = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      for (const [frequency, offset] of [
        [784, 0],
        [988, 0.16],
        [1318, 0.32],
      ] as const) {
        oscillator.frequency.setValueAtTime(frequency, startedAt + offset);
        gain.gain.setValueAtTime(0.0001, startedAt + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.62,
          startedAt + offset + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startedAt + offset + 0.12,
        );
      }
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        "ended",
        () => void closeQuietly(context),
        { once: true },
      );
      oscillator.start(startedAt);
      oscillator.stop(startedAt + 0.48);
      return "played";
    } catch {
      void closeQuietly(context);
      return "failed";
    }
  }
}

export interface HapticsPlatformBridge {
  isNativePlatform(): boolean;
}

export type HapticsBridge = Pick<HapticsPlugin, "notification" | "vibrate">;

export class CapacitorVibrationAdapter implements VibrationAdapter {
  constructor(
    private readonly platform: HapticsPlatformBridge = Capacitor,
    private readonly haptics: HapticsBridge = Haptics,
    private readonly browserVibrate: (pattern: number | number[]) => boolean =
      defaultBrowserVibrate,
  ) {}

  async vibrate(): Promise<FeedbackResult> {
    try {
      if (this.platform.isNativePlatform()) {
        await this.haptics.notification({ type: NotificationType.Warning });
        await this.haptics.vibrate({ duration: 450 });
        return "played";
      }
      return this.browserVibrate([180, 80, 260])
        ? "played"
        : "unsupported";
    } catch {
      return "failed";
    }
  }
}

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

function defaultBrowserVibrate(pattern: number | number[]): boolean {
  if (typeof globalThis.navigator?.vibrate !== "function") return false;
  return globalThis.navigator.vibrate(pattern);
}

async function closeQuietly(context: AudioContext | null): Promise<void> {
  if (!context || context.state === "closed") return;
  try {
    await context.close();
  } catch {
    // Audio shutdown is best-effort and must not interrupt the workout flow.
  }
}
