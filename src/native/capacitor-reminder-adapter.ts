import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type LocalNotificationsPlugin,
} from "@capacitor/local-notifications";
import type {
  ReminderAdapter,
  ReminderOperationResult,
  ReminderPermissionState,
  ReminderScheduleRequest,
} from "./reminder-adapter";

export const SETFLOW_REST_CHANNEL_ID = "setflow-rest-timers";

export interface CapacitorPlatformBridge {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

export type LocalNotificationsBridge = Pick<
  LocalNotificationsPlugin,
  | "checkPermissions"
  | "requestPermissions"
  | "checkExactNotificationSetting"
  | "changeExactNotificationSetting"
  | "createChannel"
  | "schedule"
  | "cancel"
>;

export class CapacitorReminderAdapter implements ReminderAdapter {
  private isAndroidChannelReady = false;

  constructor(
    private readonly platform: CapacitorPlatformBridge = Capacitor,
    private readonly notifications: LocalNotificationsBridge =
      LocalNotifications,
  ) {}

  async checkPermission(): Promise<ReminderPermissionState> {
    if (!this.platform.isNativePlatform()) return "unsupported";
    return (await this.notifications.checkPermissions()).display;
  }

  async requestPermission(): Promise<ReminderPermissionState> {
    if (!this.platform.isNativePlatform()) return "unsupported";
    return (await this.notifications.requestPermissions()).display;
  }

  async checkExactAlarmSetting(): Promise<ReminderPermissionState> {
    if (!this.platform.isNativePlatform()) return "unsupported";
    if (this.platform.getPlatform() !== "android") return "granted";
    return (await this.notifications.checkExactNotificationSetting())
      .exact_alarm;
  }

  async openExactAlarmSetting(): Promise<ReminderPermissionState> {
    if (!this.platform.isNativePlatform()) return "unsupported";
    if (this.platform.getPlatform() !== "android") return "granted";
    return (await this.notifications.changeExactNotificationSetting())
      .exact_alarm;
  }

  async schedule(
    request: ReminderScheduleRequest,
  ): Promise<ReminderOperationResult> {
    if (!this.platform.isNativePlatform()) return { status: "unsupported" };

    const isAndroid = this.platform.getPlatform() === "android";
    if (isAndroid) await this.ensureAndroidChannel();

    const notification: LocalNotificationSchema = {
      id: request.notificationId,
      title: request.title,
      body: request.body,
      autoCancel: true,
      schedule: { at: request.at, allowWhileIdle: true },
      extra: {
        kind: "rest-ended",
        timerId: request.timerId,
        workoutId: request.workoutId,
        revision: request.revision,
      },
    };
    if (isAndroid) notification.channelId = SETFLOW_REST_CHANNEL_ID;

    await this.notifications.schedule({ notifications: [notification] });
    return { status: "applied" };
  }

  async cancel(notificationId: number): Promise<ReminderOperationResult> {
    if (!this.platform.isNativePlatform()) return { status: "unsupported" };

    await this.notifications.cancel({ notifications: [{ id: notificationId }] });
    return { status: "applied" };
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (this.isAndroidChannelReady) return;

    await this.notifications.createChannel({
      id: SETFLOW_REST_CHANNEL_ID,
      name: "组间休息提醒",
      description: "在组间休息结束时提醒开始下一组",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: "#C7FF4A",
    });
    this.isAndroidChannelReady = true;
  }
}
