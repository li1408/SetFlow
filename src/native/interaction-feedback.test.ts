import { ImpactStyle } from "@capacitor/haptics";
import { describe, expect, it, vi } from "vitest";
import {
  CapacitorTapHapticsAdapter,
  InteractionFeedback,
  WebAudioTapAdapter,
} from "./interaction-feedback";

describe("InteractionFeedback", () => {
  it("contains one failed signal so the other tap feedback still runs", async () => {
    const feedback = new InteractionFeedback(
      {
        tap: async () => {
          throw new Error("audio unavailable");
        },
      },
      { tap: async () => "played" },
    );

    await expect(feedback.playTap()).resolves.toEqual({
      sound: "failed",
      haptics: "played",
    });
  });
});

describe("WebAudioTapAdapter", () => {
  it("plays a restrained tap tone and reuses its audio context", async () => {
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
    };
    const gain = { gain: gainValue, connect: vi.fn() };
    const context = {
      state: "running",
      currentTime: 4,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn(async () => undefined),
    } as unknown as AudioContext;
    const createContext = vi.fn(() => context);
    const adapter = new WebAudioTapAdapter(createContext);

    await expect(adapter.tap()).resolves.toBe("played");
    await expect(adapter.tap()).resolves.toBe("played");

    expect(createContext).toHaveBeenCalledOnce();
    expect(frequency.setValueAtTime).toHaveBeenCalledWith(720, 4);
    expect(oscillator.stop).toHaveBeenCalledWith(4.04);
  });
});

describe("CapacitorTapHapticsAdapter", () => {
  it("uses a light native impact and a short browser vibration fallback", async () => {
    const haptics = { impact: vi.fn(async () => undefined) };
    const browserVibrate = vi.fn(() => true);
    const nativeAdapter = new CapacitorTapHapticsAdapter(
      { isNativePlatform: () => true },
      haptics,
      browserVibrate,
    );
    const webAdapter = new CapacitorTapHapticsAdapter(
      { isNativePlatform: () => false },
      haptics,
      browserVibrate,
    );

    await expect(nativeAdapter.tap()).resolves.toBe("played");
    await expect(webAdapter.tap()).resolves.toBe("played");

    expect(haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
    expect(browserVibrate).toHaveBeenCalledWith(12);
  });
});
