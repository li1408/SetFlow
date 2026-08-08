import { App as CapacitorApp } from "@capacitor/app";
import { SetFlowDatabase } from "../data/database";
import { PlanRepository } from "../data/plan-repository";
import { WorkoutRepository } from "../data/workout-repository";
import { CapacitorReminderAdapter } from "../native/capacitor-reminder-adapter";
import {
  CapacitorVibrationAdapter,
  ForegroundRestAlert,
  WebAudioBeepAdapter,
} from "../native/foreground-rest-alert";
import type { ReminderPermissionState } from "../native/reminder-adapter";
import { ReminderCoordinator } from "../native/reminder-coordinator";
import type { ReminderSyncResult } from "../native/reminder-coordinator";

export interface AppReminderServices {
  checkPermission(): Promise<ReminderPermissionState>;
  requestPermission(): Promise<ReminderPermissionState>;
  checkExactAlarmSetting(): Promise<ReminderPermissionState>;
  openExactAlarmSetting(): Promise<ReminderPermissionState>;
  flush(): Promise<ReminderSyncResult>;
  notifyRestEnded(): Promise<void>;
}

export interface AppLifecycleServices {
  onForeground(listener: () => void): Promise<() => void | Promise<void>>;
}

export interface AppServices {
  plans: Pick<PlanRepository, "getActive" | "saveActive">;
  workouts: Pick<WorkoutRepository, "apply" | "recoverActive" | "start">;
  reminders: AppReminderServices;
  lifecycle: AppLifecycleServices;
  now: () => number;
  createId: () => string;
}

const database = new SetFlowDatabase();
const workoutRepository = new WorkoutRepository(database);
const reminderAdapter = new CapacitorReminderAdapter();
const reminderCoordinator = new ReminderCoordinator(
  workoutRepository,
  reminderAdapter,
);
const foregroundRestAlert = new ForegroundRestAlert(
  new WebAudioBeepAdapter(),
  new CapacitorVibrationAdapter(),
);

export const defaultAppServices: AppServices = {
  plans: new PlanRepository(database),
  workouts: workoutRepository,
  reminders: {
    checkPermission: () => reminderAdapter.checkPermission(),
    requestPermission: () => reminderAdapter.requestPermission(),
    checkExactAlarmSetting: () => reminderAdapter.checkExactAlarmSetting(),
    openExactAlarmSetting: () => reminderAdapter.openExactAlarmSetting(),
    flush: () => reminderCoordinator.flush(),
    notifyRestEnded: async () => {
      await foregroundRestAlert.notifyRestEnded();
    },
  },
  lifecycle: {
    onForeground: async (listener) => {
      const handle = await CapacitorApp.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) listener();
        },
      );
      return () => handle.remove();
    },
  },
  now: Date.now,
  createId: () => crypto.randomUUID(),
};
