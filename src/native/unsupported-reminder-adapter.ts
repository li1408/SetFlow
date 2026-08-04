import type {
  ReminderAdapter,
  ReminderOperationResult,
  ReminderPermissionState,
  ReminderScheduleRequest,
} from "./reminder-adapter";

export class UnsupportedReminderAdapter implements ReminderAdapter {
  async checkPermission(): Promise<ReminderPermissionState> {
    return "unsupported";
  }

  async requestPermission(): Promise<ReminderPermissionState> {
    return "unsupported";
  }

  async schedule(
    request: ReminderScheduleRequest,
  ): Promise<ReminderOperationResult> {
    void request;
    return { status: "unsupported" };
  }

  async cancel(notificationId: number): Promise<ReminderOperationResult> {
    void notificationId;
    return { status: "unsupported" };
  }
}
