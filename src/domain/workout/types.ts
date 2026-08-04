import type { PlannedTarget } from "../planning/types";

export interface WorkoutPlanSnapshot {
  planId: string;
  planName: string;
  exercises: Array<{
    id: string;
    name: string;
    cue: string;
    sets: number;
    target: PlannedTarget;
    restSeconds: number;
  }>;
}

export interface WorkoutPosition {
  exerciseIndex: number;
  setIndex: number;
}

export type ActualSet =
  | { kind: "reps"; reps: number; additionalWeightKg: number | null }
  | { kind: "durationSeconds"; seconds: number };

export interface PerformedSet {
  id: string;
  exerciseId: string;
  position: WorkoutPosition;
  target: PlannedTarget;
  actual: ActualSet;
  completedAt: number;
}

export interface RestTimer {
  id: string;
  revision: number;
  sourceSetId: string;
  startedAt: number;
  endsAt: number;
  totalAdjustmentSeconds: number;
}

export type WorkoutPhase =
  | { kind: "idle" }
  | { kind: "active_set"; position: WorkoutPosition }
  | {
      kind: "resting";
      completedPosition: WorkoutPosition;
      nextPosition: WorkoutPosition;
      timer: RestTimer;
    }
  | { kind: "next_set_ready"; position: WorkoutPosition }
  | { kind: "completed"; completedAt: number };

export interface WorkoutSession {
  id: string;
  snapshot: WorkoutPlanSnapshot;
  phase: WorkoutPhase;
  performedSets: PerformedSet[];
  startedAt: number | null;
}

export type WorkoutEvent =
  | { type: "start"; at: number }
  | {
      type: "complete_set";
      expectedPosition: WorkoutPosition;
      performedSetId: string;
      restTimerId: string;
      at: number;
      actual: ActualSet;
    }
  | {
      type: "rest_elapsed";
      timerId: string;
      expectedRevision: number;
      at: number;
    }
  | {
      type: "adjust_rest";
      timerId: string;
      expectedRevision: number;
      deltaSeconds: -15 | 15;
      at: number;
    }
  | {
      type: "skip_rest";
      timerId: string;
      expectedRevision: number;
      at: number;
    }
  | { type: "activate_next_set"; expectedPosition: WorkoutPosition };

export type WorkoutFact =
  | { type: "WORKOUT_STARTED" }
  | { type: "SET_COMPLETED"; performedSetId: string }
  | { type: "REST_STARTED"; timer: RestTimer }
  | { type: "REST_RESCHEDULED"; timer: RestTimer }
  | { type: "REST_FINISHED"; timerId: string }
  | { type: "REST_SKIPPED"; timerId: string }
  | { type: "WORKOUT_COMPLETED" };

export type WorkoutTransition =
  | { kind: "changed"; state: WorkoutSession; facts: WorkoutFact[] }
  | {
      kind: "noop";
      state: WorkoutSession;
      reason:
        | "DUPLICATE_SET"
        | "STALE_TIMER"
        | "STALE_REVISION"
        | "REST_NOT_DUE";
    }
  | {
      kind: "rejected";
      state: WorkoutSession;
      error: { code: "INVALID_TRANSITION" | "MEASUREMENT_KIND_MISMATCH" };
    };
