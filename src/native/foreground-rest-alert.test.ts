import { describe, expect, it, vi } from "vitest";
import {
  CapacitorVibrationAdapter,
  ForegroundRestAlert,
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

describe("WebAudioBeepAdapter", () => {
  it("reports unsupported when Web Audio is unavailable", async () => {
    const adapter = new WebAudioBeepAdapter(() => null);

    await expect(adapter.beep()).resolves.toBe("unsupported");
  });

  it("plays a short tone through an injected audio context", async () => {
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

    expect(frequency.setValueAtTime).toHaveBeenCalledWith(880, 10);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(10.18);
    expect(oscillator.addEventListener).toHaveBeenCalledWith(
      "ended",
      expect.any(Function),
      { once: true },
    );
  });
});

describe("CapacitorVibrationAdapter", () => {
  it("uses Capacitor Haptics on native platforms", async () => {
    const haptics = { vibrate: vi.fn(async () => undefined) };
    const browserVibrate = vi.fn(() => true);
    const adapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => true },
      haptics,
      browserVibrate,
    );

    await expect(adapter.vibrate()).resolves.toBe("played");

    expect(haptics.vibrate).toHaveBeenCalledWith({ duration: 180 });
    expect(browserVibrate).not.toHaveBeenCalled();
  });

  it("falls back to browser vibration and contains device failures", async () => {
    const haptics = {
      vibrate: vi.fn(async () => {
        throw new Error("bridge failed");
      }),
    };
    const webAdapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => false },
      haptics,
      () => true,
    );
    const nativeAdapter = new CapacitorVibrationAdapter(
      { isNativePlatform: () => true },
      haptics,
      () => false,
    );

    await expect(webAdapter.vibrate()).resolves.toBe("played");
    await expect(nativeAdapter.vibrate()).resolves.toBe("failed");
  });
});
