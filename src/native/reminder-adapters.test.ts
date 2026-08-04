import { describe, expect, it, vi } from "vitest";
import type { PermissionStatus } from "@capacitor/local-notifications";
import {
  CapacitorReminderAdapter,
  SETFLOW_REST_CHANNEL_ID,
} from "./capacitor-reminder-adapter";
import type { ReminderScheduleRequest } from "./reminder-adapter";
import { UnsupportedReminderAdapter } from "./unsupported-reminder-adapter";

const request: ReminderScheduleRequest = {
  notificationId: 42,
  at: new Date(75_000),
  title: "休息结束",
  body: "准备开始下一组",
  timerId: "rest-1",
  workoutId: "workout-1",
  revision: 2,
};

describe("UnsupportedReminderAdapter", () => {
  it("reports unsupported without trying browser notifications", async () => {
    const adapter = new UnsupportedReminderAdapter();

    await expect(adapter.checkPermission()).resolves.toBe("unsupported");
    await expect(adapter.requestPermission()).resolves.toBe("unsupported");
    await expect(adapter.schedule(request)).resolves.toEqual({
      status: "unsupported",
    });
    await expect(adapter.cancel(42)).resolves.toEqual({
      status: "unsupported",
    });
  });
});

describe("CapacitorReminderAdapter", () => {
  it("never calls the Capacitor plugin outside a native platform", async () => {
    const notifications = fakeNotifications();
    const adapter = new CapacitorReminderAdapter(
      { isNativePlatform: () => false, getPlatform: () => "web" },
      notifications,
    );

    await expect(adapter.checkPermission()).resolves.toBe("unsupported");
    await expect(adapter.requestPermission()).resolves.toBe("unsupported");
    await expect(adapter.schedule(request)).resolves.toEqual({
      status: "unsupported",
    });
    await expect(adapter.cancel(42)).resolves.toEqual({
      status: "unsupported",
    });
    expect(notifications.checkPermissions).not.toHaveBeenCalled();
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(notifications.createChannel).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });

  it("checks and requests notification permission only when explicitly called", async () => {
    const notifications = fakeNotifications();
    notifications.checkPermissions.mockResolvedValue({ display: "prompt" });
    notifications.requestPermissions.mockResolvedValue({ display: "granted" });
    const adapter = new CapacitorReminderAdapter(
      { isNativePlatform: () => true, getPlatform: () => "android" },
      notifications,
    );

    await expect(adapter.checkPermission()).resolves.toBe("prompt");
    await expect(adapter.requestPermission()).resolves.toBe("granted");
    expect(notifications.checkPermissions).toHaveBeenCalledOnce();
    expect(notifications.requestPermissions).toHaveBeenCalledOnce();
  });

  it("creates the Android rest channel once and schedules at the supplied Date", async () => {
    const notifications = fakeNotifications();
    const adapter = new CapacitorReminderAdapter(
      { isNativePlatform: () => true, getPlatform: () => "android" },
      notifications,
    );

    await expect(adapter.schedule(request)).resolves.toEqual({
      status: "applied",
    });
    await adapter.schedule({ ...request, notificationId: 43 });

    expect(notifications.createChannel).toHaveBeenCalledOnce();
    expect(notifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SETFLOW_REST_CHANNEL_ID,
        importance: 4,
        visibility: 1,
        vibration: true,
      }),
    );
    expect(notifications.schedule).toHaveBeenNthCalledWith(1, {
      notifications: [
        {
          id: 42,
          title: "休息结束",
          body: "准备开始下一组",
          channelId: SETFLOW_REST_CHANNEL_ID,
          autoCancel: true,
          schedule: { at: request.at, allowWhileIdle: true },
          extra: {
            kind: "rest-ended",
            timerId: "rest-1",
            workoutId: "workout-1",
            revision: 2,
          },
        },
      ],
    });
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
  });

  it("cancels the native notification by identifier", async () => {
    const notifications = fakeNotifications();
    const adapter = new CapacitorReminderAdapter(
      { isNativePlatform: () => true, getPlatform: () => "android" },
      notifications,
    );

    await expect(adapter.cancel(42)).resolves.toEqual({ status: "applied" });

    expect(notifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 42 }],
    });
  });
});

function fakeNotifications() {
  return {
    checkPermissions: vi.fn(
      async (): Promise<PermissionStatus> => ({ display: "granted" }),
    ),
    requestPermissions: vi.fn(
      async (): Promise<PermissionStatus> => ({ display: "granted" }),
    ),
    createChannel: vi.fn(async () => undefined),
    schedule: vi.fn(async () => ({ notifications: [] })),
    cancel: vi.fn(async () => undefined),
  };
}
