import { App as CapacitorApp } from "@capacitor/app";
import { SetFlowDatabase } from "../data/database";
import { PlanRepository } from "../data/plan-repository";
import { WorkoutRepository } from "../data/workout-repository";
import { CapacitorReminderAdapter } from "../native/capacitor-reminder-adapter";
import {
  CapacitorVibrationAdapter,
  ForegroundRestAlert,
  RepeatingForegroundRestAlert,
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
  startRestEndedAlert(): void;
  stopRestEndedAlert(): void;
}

export interface AppLifecycleServices {
  onForeground(listener: () => void): Promise<() => void | Promise<void>>;
}

export interface AppNavigationServices {
  onBackButton(listener: () => void): Promise<() => void | Promise<void>>;
  exitApp(): Promise<void>;
}

export interface AppServices {
  plans: Pick<PlanRepository, "getActive" | "saveActive">;
  workouts: Pick<WorkoutRepository, "apply" | "end" | "recoverActive" | "start">;
  reminders: AppReminderServices;
  lifecycle: AppLifecycleServices;
  navigation: AppNavigationServices;
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
const repeatingForegroundRestAlert = new RepeatingForegroundRestAlert(
  foregroundRestAlert,
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
    startRestEndedAlert: () => repeatingForegroundRestAlert.start(),
    stopRestEndedAlert: () => repeatingForegroundRestAlert.stop(),
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
  navigation: {
    onBackButton: async (listener) => {
      const handle = await CapacitorApp.addListener("backButton", listener);
      return () => handle.remove();
    },
    exitApp: () => CapacitorApp.exitApp(),
  },
  now: Date.now,
  createId: () => crypto.randomUUID(),
};
