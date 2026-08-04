import Dexie, { type Table } from "dexie";
import {
  DATABASE_SCHEMA_VERSION,
  type StoredActiveRest,
  type StoredPlan,
  type StoredSetting,
  type StoredWorkout,
} from "./types";

export class SetFlowDatabase extends Dexie {
  workouts!: Table<StoredWorkout, string>;
  activeRestTimers!: Table<StoredActiveRest, string>;
  plans!: Table<StoredPlan, string>;
  settings!: Table<StoredSetting, string>;

  constructor(name = "setflow") {
    super(name);

    this.version(DATABASE_SCHEMA_VERSION).stores({
      workouts: "&id,&activeSlot,status,updatedAt",
      activeRestTimers:
        "&id,&notificationId,&activeSlot,workoutId,status,notificationSync,endsAt,updatedAt",
      plans: "&id,&activeSlot,status,updatedAt",
      settings: "&key,updatedAt",
    });

    this.workouts = this.table("workouts");
    this.activeRestTimers = this.table("activeRestTimers");
    this.plans = this.table("plans");
    this.settings = this.table("settings");
  }
}
