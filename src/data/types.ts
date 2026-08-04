import type { PlanDraft } from "../domain/planning/types";
import type { WorkoutSession } from "../domain/workout/types";

export const DATABASE_SCHEMA_VERSION = 1;

export interface StoredWorkout {
  id: string;
  session: WorkoutSession;
  status: "active" | "completed";
  activeSlot?: "active";
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface StoredActiveRest {
  id: string;
  workoutId: string;
  revision: number;
  sourceSetId: string;
  startedAt: number;
  endsAt: number;
  totalAdjustmentSeconds: number;
  notificationId: number;
  activeSlot?: "active";
  status: "active" | "finished" | "skipped";
  handledAt: number | null;
  updatedAt: number;
  schemaVersion: number;
}

export interface StoredReminderJob {
  id: string;
  timerId: string;
  workoutId: string;
  revision: number;
  action: "schedule" | "cancel";
  notificationId: number;
  endsAt: number | null;
  status: "pending" | "synced" | "blocked" | "superseded";
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface StoredPlan {
  id: string;
  name: string;
  draft: PlanDraft;
  status: "active" | "archived";
  activeSlot?: "active";
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface StoredSetting {
  key: string;
  value: unknown;
  updatedAt: number;
  schemaVersion: number;
}
