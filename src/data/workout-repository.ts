import { transitionWorkout } from "../domain/workout/workout-machine";
import type {
  RestTimer,
  WorkoutEvent,
  WorkoutSession,
  WorkoutTransition,
} from "../domain/workout/types";
import type { SetFlowDatabase } from "./database";
import {
  DATABASE_SCHEMA_VERSION,
  type StoredActiveRest,
  type StoredWorkout,
} from "./types";
import { parseWorkoutSession } from "./workout-validation";

export class ActiveWorkoutExistsError extends Error {
  constructor() {
    super("Only one active workout is allowed");
    this.name = "ActiveWorkoutExistsError";
  }
}

export class WorkoutNotFoundError extends Error {
  constructor(id: string) {
    super(`Workout not found: ${id}`);
    this.name = "WorkoutNotFoundError";
  }
}

export class WorkoutRepository {
  constructor(
    private readonly database: SetFlowDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async create(session: WorkoutSession): Promise<void> {
    const validatedSession = parseWorkoutSession(session);

    await this.database.transaction("rw", this.database.workouts, async () => {
      const existing = await this.database.workouts
        .where("status")
        .equals("active")
        .first();
      if (existing) throw new ActiveWorkoutExistsError();

      const now = this.now();
      await this.database.workouts.add({
        id: validatedSession.id,
        session: validatedSession,
        status: "active",
        activeSlot: "active",
        createdAt: now,
        updatedAt: now,
        schemaVersion: DATABASE_SCHEMA_VERSION,
      });
    });
  }

  async getActive(): Promise<WorkoutSession | null> {
    const record = await this.database.workouts
      .where("activeSlot")
      .equals("active")
      .first();

    return record ? parseWorkoutSession(record.session) : null;
  }

  async getActiveRest(workoutId: string): Promise<StoredActiveRest | null> {
    const record = await this.database.activeRestTimers
      .where("activeSlot")
      .equals("active")
      .first();
    return record?.workoutId === workoutId ? record : null;
  }

  async listReminderJobs(): Promise<StoredActiveRest[]> {
    return this.database.activeRestTimers
      .where("notificationSync")
      .equals("pending")
      .sortBy("updatedAt");
  }

  async markReminderApplied(command: {
    timerId: string;
    expectedRevision: number;
    desiredNativeState: StoredActiveRest["desiredNativeState"];
  }): Promise<boolean> {
    return this.database.transaction(
      "rw",
      this.database.activeRestTimers,
      async () => {
        const record = await this.database.activeRestTimers.get(command.timerId);
        if (
          !record ||
          record.revision !== command.expectedRevision ||
          record.desiredNativeState !== command.desiredNativeState
        ) {
          return false;
        }

        await this.database.activeRestTimers.update(record.id, {
          notificationSync: "synced",
          updatedAt: this.now(),
        });
        return true;
      },
    );
  }

  async recoverActive(at: number): Promise<WorkoutSession | null> {
    const active = await this.getActive();
    if (active?.phase.kind !== "resting" || active.phase.timer.endsAt > at) {
      return active;
    }

    const transition = await this.apply(active.id, {
      type: "rest_elapsed",
      timerId: active.phase.timer.id,
      expectedRevision: active.phase.timer.revision,
      at,
    });
    return transition.state;
  }

  async apply(
    workoutId: string,
    event: WorkoutEvent,
  ): Promise<WorkoutTransition> {
    return this.database.transaction(
      "rw",
      this.database.workouts,
      this.database.activeRestTimers,
      async () => {
        const record = await this.database.workouts.get(workoutId);
        if (!record) throw new WorkoutNotFoundError(workoutId);

        const current = parseWorkoutSession(record.session);
        const transition = transitionWorkout(current, event);
        if (transition.kind !== "changed") return transition;

        const now = this.now();
        const storedWorkout: StoredWorkout = {
          ...record,
          session: transition.state,
          status:
            transition.state.phase.kind === "completed"
              ? "completed"
              : "active",
          updatedAt: now,
          schemaVersion: DATABASE_SCHEMA_VERSION,
        };
        if (transition.state.phase.kind === "completed") {
          delete storedWorkout.activeSlot;
        } else {
          storedWorkout.activeSlot = "active";
        }
        await this.database.workouts.put(storedWorkout);

        for (const fact of transition.facts) {
          if (fact.type === "REST_STARTED" || fact.type === "REST_RESCHEDULED") {
            await this.persistRest(workoutId, fact.timer, now);
          }
          if (fact.type === "REST_FINISHED" || fact.type === "REST_SKIPPED") {
            await this.finishRest(
              fact.timerId,
              fact.type === "REST_SKIPPED" ? "skipped" : "finished",
              now,
            );
          }
        }

        if (transition.state.phase.kind === "completed") {
          const activeRest = await this.getActiveRest(workoutId);
          if (activeRest) await this.finishRest(activeRest.id, "finished", now);
        }

        return transition;
      },
    );
  }

  private async persistRest(
    workoutId: string,
    timer: RestTimer,
    updatedAt: number,
  ): Promise<void> {
    const existing = await this.database.activeRestTimers.get(timer.id);
    await this.database.activeRestTimers.put({
      id: timer.id,
      workoutId,
      revision: timer.revision,
      sourceSetId: timer.sourceSetId,
      startedAt: timer.startedAt,
      endsAt: timer.endsAt,
      totalAdjustmentSeconds: timer.totalAdjustmentSeconds,
      notificationId: existing?.notificationId ?? notificationIdFor(timer.id),
      activeSlot: "active",
      status: "active",
      desiredNativeState: "scheduled",
      notificationSync: "pending",
      handledAt: null,
      updatedAt,
      schemaVersion: DATABASE_SCHEMA_VERSION,
    });
  }

  private async finishRest(
    timerId: string,
    status: "finished" | "skipped",
    updatedAt: number,
  ): Promise<void> {
    const record = await this.database.activeRestTimers.get(timerId);
    if (!record) return;

    const finished = {
      ...record,
      status,
      desiredNativeState: "canceled" as const,
      notificationSync: "pending" as const,
      handledAt: updatedAt,
      updatedAt,
    };
    delete finished.activeSlot;
    await this.database.activeRestTimers.put(finished);
  }
}

function notificationIdFor(timerId: string): number {
  let hash = 2_166_136_261;
  for (const character of timerId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 2_147_483_646 + 1;
}
