import { NotificationType } from "@capacitor/haptics";
import { describe, expect, it, vi } from "vitest";
import {
  CapacitorVibrationAdapter,
  ForegroundRestAlert,
  RepeatingForegroundRestAlert,
  WebAudioBeepAdapter,
} from "./foreground-rest-alert";

describe("ForegroundRestAlert", () => {
  it("contains one feedback failure so the other signal can still run", async () => {
    const alert = new ForegroundRestAlert(
      {
        beep: async () => {
          throw new Error("audio unavailable");
        },
      },
      { vibrate: async () => "played" },
    );

    await expect(alert.notifyRestEnded()).resolves.toEqual({
      beep: "failed",
      vibration: "played",
    });
  });
});

describe("RepeatingForegroundRestAlert", () => {
  it("repeats the foreground alert until it is manually stopped", async () => {
    vi.useFakeTimers();
    const notify = vi.fn(async () => undefined);
    const alert = new RepeatingForegroundRestAlert({ notifyRestEnded: notify });

    alert.start();
    await Promise.resolve();
    expect(notify).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(notify).toHaveBeenCalledTimes(2);

    alert.stop();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});

describe("WebAudioBeepAdapter", () => {
  it("reports unsupported when Web Audio is unavailable", async () => {
    const adapter = new WebAudioBeepAdapter(() => null);

    await expect(adapter.beep()).resolves.toBe("unsupported");
  });

  it("plays a three-note rest-finished chime through an injected audio context", async () => {
    const frequency = { setValueAtTime: vi.fn() };
    const gainValue = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    const oscillator = {
      type: "sine" as OscillatorType,
      frequency,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
    };
    const gain = {
      gain: gainValue,
      connect: vi.fn(),
    };
    const context = {
      state: "running",
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext;
    const adapter = new WebAudioBeepAdapter(() => context);

    await expect(adapter.beep()).resolves.toBe("played");

    expect(frequency.setValueAtTime).toHaveBeenNthCalledWith(1, 784, 10);
    expect(frequency.setValueAtTime).toHaveBeenNthCalledWith(2, 988, 10.16);
    expect(frequency.setValueAtTime).toHaveBeenNthCalledWith(3, 1318, 10.32);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(10.48);
    expect(oscillator.addEventListener).toHaveBeenCalledWith(
      "ended",
      expect.any(Function),
      { once: true },
    );
  });
});

describe("CapacitorVibrationAdapter", () => {
  it("uses Capacitor Haptics on native platforms", async () => {
    const haptics = {
      notification: vi.fn(async () => undefined),
      vibrate: vi.fn(async () => undefined),
    };
    const browserVibrate = vi.fn(() => true);
    const adapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => true },
      haptics,
      browserVibrate,
    );

    await expect(adapter.vibrate()).resolves.toBe("played");

    expect(haptics.notification).toHaveBeenCalledWith({
      type: NotificationType.Warning,
    });
    expect(haptics.vibrate).toHaveBeenCalledWith({ duration: 450 });
    expect(browserVibrate).not.toHaveBeenCalled();
  });

  it("falls back to browser vibration and contains device failures", async () => {
    const haptics = {
      notification: vi.fn(async () => undefined),
      vibrate: vi.fn(async () => {
        throw new Error("bridge failed");
      }),
    };
    const browserVibrate = vi.fn(() => true);
    const webAdapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => false },
      haptics,
      browserVibrate,
    );
    const nativeAdapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => true },
      haptics,
      () => false,
    );

    await expect(webAdapter.vibrate()).resolves.toBe("played");
    await expect(nativeAdapter.vibrate()).resolves.toBe("failed");
    expect(browserVibrate).toHaveBeenCalledWith([180, 80, 260]);
  });
});
