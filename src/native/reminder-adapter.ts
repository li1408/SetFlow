import type { PermissionState } from "@capacitor/core";

export type ReminderPermissionState = PermissionState | "unsupported";

export type ReminderOperationResult =
  | { status: "applied" }
  | { status: "unsupported" };

export interface ReminderScheduleRequest {
  notificationId: number;
  at: Date;
  title: string;
  body: string;
  timerId: string;
  workoutId: string;
  revision: number;
}

export interface ReminderAdapter {
  checkPermission(): Promise<ReminderPermissionState>;
  requestPermission(): Promise<ReminderPermissionState>;
  checkExactAlarmSetting(): Promise<ReminderPermissionState>;
  openExactAlarmSetting(): Promise<ReminderPermissionState>;
  schedule(
    request: ReminderScheduleRequest,
  ): Promise<ReminderOperationResult>;
  cancel(notificationId: number): Promise<ReminderOperationResult>;
}
