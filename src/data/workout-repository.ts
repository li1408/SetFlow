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
  type StoredReminderJob,
  type StoredWorkout,
} from "./types";
import {
  parseWorkoutEvent,
  parseWorkoutSession,
} from "./workout-validation";

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

export class InvalidInitialWorkoutError extends Error {
  constructor() {
    super("An active workout must start as a fresh idle session");
    this.name = "InvalidInitialWorkoutError";
  }
}

export class WorkoutRepository {
  constructor(
    private readonly database: SetFlowDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async create(session: WorkoutSession): Promise<void> {
    const validatedSession = parseWorkoutSession(session);
    if (
      validatedSession.phase.kind !== "idle" ||
      validatedSession.startedAt !== null ||
      validatedSession.performedSets.length > 0
    ) {
      throw new InvalidInitialWorkoutError();
    }

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

  async listReminderJobs(): Promise<StoredReminderJob[]> {
    const jobs = await this.database.reminderJobs
      .where("status")
      .equals("pending")
      .toArray();
    return jobs.sort(
      (left, right) =>
        reminderActionRank(left.action) - reminderActionRank(right.action) ||
        left.createdAt - right.createdAt ||
        left.id.localeCompare(right.id),
    );
  }

  async markReminderApplied(command: {
    jobId: string;
  }): Promise<
    | { applied: true }
    | { applied: false; compensateCancelNotificationId?: number }
  > {
    return this.database.transaction(
      "rw",
      this.database.reminderJobs,
      async () => {
        const job = await this.database.reminderJobs.get(command.jobId);
        if (!job || job.status !== "pending") {
          return {
            applied: false as const,
            ...(job?.action === "schedule"
              ? { compensateCancelNotificationId: job.notificationId }
              : {}),
          };
        }

        await this.database.reminderJobs.update(job.id, {
          status: "synced",
          updatedAt: this.now(),
        });
        return { applied: true as const };
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
    const validatedEvent = parseWorkoutEvent(event);

    return this.database.transaction(
      "rw",
      this.database.workouts,
      this.database.activeRestTimers,
      this.database.reminderJobs,
      async () => {
        const record = await this.database.workouts.get(workoutId);
        if (!record) throw new WorkoutNotFoundError(workoutId);

        const current = parseWorkoutSession(record.session);
        const transition = transitionWorkout(current, validatedEvent);
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
    if (existing && existing.revision !== timer.revision) {
      await this.supersedeSchedule(existing);
      await this.queueCancel(existing, updatedAt);
    }
    const notificationId =
      existing?.revision === timer.revision
        ? existing.notificationId
        : notificationIdFor(timer.id, timer.revision);
    await this.database.activeRestTimers.put({
      id: timer.id,
      workoutId,
      revision: timer.revision,
      sourceSetId: timer.sourceSetId,
      startedAt: timer.startedAt,
      endsAt: timer.endsAt,
      totalAdjustmentSeconds: timer.totalAdjustmentSeconds,
      notificationId,
      activeSlot: "active",
      status: "active",
      handledAt: null,
      updatedAt,
      schemaVersion: DATABASE_SCHEMA_VERSION,
    });
    await this.queueSchedule(
      {
        id: timer.id,
        workoutId,
        revision: timer.revision,
        notificationId,
        endsAt: timer.endsAt,
      },
      updatedAt,
    );
  }

  private async finishRest(
    timerId: string,
    status: "finished" | "skipped",
    updatedAt: number,
  ): Promise<void> {
    const record = await this.database.activeRestTimers.get(timerId);
    if (!record) return;

    await this.supersedeSchedule(record);
    await this.queueCancel(record, updatedAt);

    const finished = {
      ...record,
      status,
      handledAt: updatedAt,
      updatedAt,
    };
    delete finished.activeSlot;
    await this.database.activeRestTimers.put(finished);
  }

  private async supersedeSchedule(rest: StoredActiveRest): Promise<void> {
    const jobId = reminderJobId(rest.id, rest.revision, "schedule");
    const job = await this.database.reminderJobs.get(jobId);
    if (job?.status === "pending") {
      await this.database.reminderJobs.update(jobId, {
        status: "superseded",
        updatedAt: this.now(),
      });
    }
  }

  private async queueSchedule(
    rest: {
      id: string;
      workoutId: string;
      revision: number;
      notificationId: number;
      endsAt: number;
    },
    now: number,
  ): Promise<void> {
    const id = reminderJobId(rest.id, rest.revision, "schedule");
    const existing = await this.database.reminderJobs.get(id);
    if (existing) return;

    await this.database.reminderJobs.add({
      id,
      timerId: rest.id,
      workoutId: rest.workoutId,
      revision: rest.revision,
      action: "schedule",
      notificationId: rest.notificationId,
      endsAt: rest.endsAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      schemaVersion: DATABASE_SCHEMA_VERSION,
    });
  }

  private async queueCancel(rest: StoredActiveRest, now: number): Promise<void> {
    const id = reminderJobId(rest.id, rest.revision, "cancel");
    const existing = await this.database.reminderJobs.get(id);
    if (existing) return;

    await this.database.reminderJobs.add({
      id,
      timerId: rest.id,
      workoutId: rest.workoutId,
      revision: rest.revision,
      action: "cancel",
      notificationId: rest.notificationId,
      endsAt: null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      schemaVersion: DATABASE_SCHEMA_VERSION,
    });
  }
}

function reminderJobId(
  timerId: string,
  revision: number,
  action: StoredReminderJob["action"],
): string {
  return `${timerId}:${revision}:${action}`;
}

function reminderActionRank(action: StoredReminderJob["action"]): number {
  return action === "cancel" ? 0 : 1;
}

function notificationIdFor(timerId: string, revision: number): number {
  let hash = 2_166_136_261;
  for (const character of `${timerId}:${revision}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 2_147_483_646 + 1;
}
