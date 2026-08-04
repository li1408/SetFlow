import type { GeneratedPlanDraft } from "../domain/planning/types";
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
  desiredNativeState: "scheduled" | "canceled";
  notificationSync: "pending" | "synced" | "blocked";
  handledAt: number | null;
  updatedAt: number;
  schemaVersion: number;
}

export interface StoredPlan {
  id: string;
  name: string;
  draft: GeneratedPlanDraft;
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
