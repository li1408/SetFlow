import { afterEach, describe, expect, it } from "vitest";
import { createWorkoutSession } from "../domain/workout/workout-machine";
import type {
  WorkoutSession,
  WorkoutEvent,
  WorkoutPlanSnapshot,
} from "../domain/workout/types";
import { SetFlowDatabase } from "./database";
import {
  ActiveWorkoutExistsError,
  InvalidInitialWorkoutError,
  WorkoutRepository,
} from "./workout-repository";

const openedDatabases: SetFlowDatabase[] = [];

const snapshot: WorkoutPlanSnapshot = {
  planId: "plan-home",
  planName: "居家基础",
  exercises: [
    {
      id: "bodyweight-squat",
      name: "徒手深蹲",
      cue: "脚掌稳稳踩地，膝盖跟随脚尖方向下蹲。",
      sets: 2,
      target: { kind: "reps", min: 8, max: 12, basis: "total" },
      restSeconds: 60,
    },
  ],
};

afterEach(async () => {
  await Promise.all(
    openedDatabases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe("WorkoutRepository", () => {
  it("atomically persists a completed set and restores its active rest", async () => {
    const databaseName = `setflow-workout-${crypto.randomUUID()}`;
    const firstDatabase = track(new SetFlowDatabase(databaseName));
    const repository = new WorkoutRepository(firstDatabase, () => 2_000);
    const idle = createWorkoutSession("session-1", snapshot);
    await repository.create(idle);
    await repository.apply("session-1", { type: "start", at: 1_000 });

    const event: WorkoutEvent = {
      type: "complete_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 0 },
      performedSetId: "performed-1",
      restTimerId: "rest-1",
      at: 2_000,
      actual: { kind: "reps", reps: 10, additionalWeightKg: null },
    };
    const transition = await repository.apply("session-1", event);

    expect(transition).toMatchObject({ kind: "changed" });
    expect(await repository.getActiveRest("session-1")).toMatchObject({
      id: "rest-1",
      workoutId: "session-1",
      revision: 0,
      endsAt: 62_000,
      status: "active",
    });
    expect(await repository.listReminderJobs()).toEqual([
      expect.objectContaining({
        timerId: "rest-1",
        revision: 0,
        action: "schedule",
        status: "pending",
      }),
    ]);

    firstDatabase.close();
    const reopenedDatabase = track(new SetFlowDatabase(databaseName));
    const reopened = new WorkoutRepository(reopenedDatabase, () => 2_100);
    const restored = await reopened.getActive();

    expect(restored).toMatchObject({
      id: "session-1",
      performedSets: [{ id: "performed-1" }],
      phase: { kind: "resting", timer: { endsAt: 62_000 } },
    });

    const replayed = await reopened.apply("session-1", event);
    expect(replayed).toMatchObject({ kind: "noop", reason: "DUPLICATE_SET" });
    expect((await reopened.getActive())?.performedSets).toHaveLength(1);
    expect(await reopenedDatabase.activeRestTimers.count()).toBe(1);
  });

  it("updates or removes the single active rest with the workout transition", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-rest-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 10_000);
    await createRestingWorkout(repository);

    await repository.apply("session-1", {
      type: "adjust_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      deltaSeconds: 15,
      at: 10_000,
    });
    expect(await repository.getActiveRest("session-1")).toMatchObject({
      revision: 1,
      endsAt: 77_000,
    });

    await repository.apply("session-1", {
      type: "skip_rest",
      timerId: "rest-1",
      expectedRevision: 1,
      at: 11_000,
    });
    expect(await repository.getActiveRest("session-1")).toBeNull();
    const reminderJobs = await repository.listReminderJobs();
    expect(reminderJobs.map((job) => job.action)).toEqual([
      "cancel",
      "cancel",
    ]);
    expect(reminderJobs.map((job) => job.revision)).toEqual([0, 1]);
    expect(await database.activeRestTimers.get("rest-1")).toMatchObject({
      status: "skipped",
    });
    expect(await repository.getActive()).toMatchObject({
      phase: { kind: "next_set_ready" },
    });
  });

  it("ignores a stale native reminder acknowledgement after rescheduling", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-reminder-cas-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 10_000);
    await createRestingWorkout(repository);
    const originalSchedule = (await repository.listReminderJobs())[0]!;
    await repository.apply("session-1", {
      type: "adjust_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      deltaSeconds: 15,
      at: 10_000,
    });

    await expect(
      repository.markReminderApplied({
        jobId: originalSchedule.id,
      }),
    ).resolves.toEqual({
      applied: false,
      compensateCancelNotificationId: originalSchedule.notificationId,
    });

    const currentJobs = await repository.listReminderJobs();
    expect(currentJobs.map((job) => job.action)).toEqual([
      "cancel",
      "schedule",
    ]);
    for (const job of currentJobs) {
      await expect(repository.markReminderApplied({ jobId: job.id })).resolves.toEqual({
        applied: true,
      });
    }
    expect(await repository.listReminderJobs()).toEqual([]);
  });

  it("advances an expired persisted rest once during recovery", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-recovery-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 70_000);
    await createRestingWorkout(repository);

    const firstRecovery = await repository.recoverActive(70_000);
    expect(firstRecovery).toMatchObject({
      phase: { kind: "next_set_ready" },
      performedSets: [{ id: "performed-1" }],
    });

    const secondRecovery = await repository.recoverActive(71_000);
    expect(secondRecovery).toEqual(firstRecovery);
    expect(await repository.listReminderJobs()).toEqual([
      expect.objectContaining({
        timerId: "rest-1",
        action: "cancel",
        revision: 0,
      }),
    ]);
  });

  it("recovers a legacy idle active record by starting it", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-idle-recovery-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 4_000);
    await repository.create(createWorkoutSession("session-1", snapshot));

    const recovered = await repository.recoverActive(4_000);

    expect(recovered).toMatchObject({
      id: "session-1",
      startedAt: 4_000,
      phase: {
        kind: "active_set",
        position: { exerciseIndex: 0, setIndex: 0 },
      },
    });
  });

  it("requeues the active rest after the operating system loses its alarm", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-rest-requeue-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 10_000);
    await createRestingWorkout(repository);
    const original = (await repository.listReminderJobs())[0]!;
    await repository.markReminderApplied({ jobId: original.id });
    expect(await repository.listReminderJobs()).toEqual([]);

    await repository.requeueActiveRestReminder();

    expect(await repository.listReminderJobs()).toEqual([
      expect.objectContaining({
        id: original.id,
        timerId: "rest-1",
        revision: 0,
        action: "schedule",
        status: "pending",
      }),
    ]);
  });

  it("does not requeue a reminder whose persisted rest already expired", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-expired-requeue-${crypto.randomUUID()}`),
    );
    let now = 10_000;
    const repository = new WorkoutRepository(database, () => now);
    await createRestingWorkout(repository);
    const original = (await repository.listReminderJobs())[0]!;
    await repository.markReminderApplied({ jobId: original.id });
    now = 70_000;

    await repository.requeueActiveRestReminder();

    expect(await repository.listReminderJobs()).toEqual([]);
  });

  it("rolls back the workout when the active-rest invariant is violated", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-rollback-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 2_000);
    await repository.create(createWorkoutSession("session-1", snapshot));
    await repository.apply("session-1", { type: "start", at: 1_000 });
    await database.activeRestTimers.add({
      id: "conflicting-rest",
      workoutId: "corrupt-workout",
      revision: 0,
      sourceSetId: "source",
      startedAt: 0,
      endsAt: 99_000,
      totalAdjustmentSeconds: 0,
      notificationId: 99,
      activeSlot: "active",
      status: "active",
      handledAt: null,
      updatedAt: 0,
      schemaVersion: 1,
    });

    await expect(
      repository.apply("session-1", {
        type: "complete_set",
        expectedPosition: { exerciseIndex: 0, setIndex: 0 },
        performedSetId: "performed-1",
        restTimerId: "rest-1",
        at: 2_000,
        actual: { kind: "reps", reps: 10, additionalWeightKg: null },
      }),
    ).rejects.toBeTruthy();

    expect(await repository.getActive()).toMatchObject({
      performedSets: [],
      phase: { kind: "active_set" },
    });
  });

  it("rejects a second active workout without replacing the first", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-single-active-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 1_000);
    await repository.create(createWorkoutSession("session-1", snapshot));

    await expect(
      repository.create(createWorkoutSession("session-2", snapshot)),
    ).rejects.toBeInstanceOf(ActiveWorkoutExistsError);
    expect((await repository.getActive())?.id).toBe("session-1");
  });

  it("creates and starts a workout in one atomic repository operation", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-atomic-start-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 1_000);
    const idle = createWorkoutSession("session-1", snapshot);

    const transition = await repository.start(idle, 750);

    expect(transition).toMatchObject({
      kind: "changed",
      state: {
        id: "session-1",
        startedAt: 750,
        phase: {
          kind: "active_set",
          position: { exerciseIndex: 0, setIndex: 0 },
        },
      },
    });
    expect(await repository.getActive()).toEqual(transition.state);
    expect(await database.workouts.count()).toBe(1);
  });

  it("rejects non-fresh sessions when creating an active workout", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-fresh-only-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 1_000);
    const completed: WorkoutSession = {
      ...createWorkoutSession("session-completed", snapshot),
      startedAt: 500,
      phase: { kind: "completed", completedAt: 1_000 },
    };

    await expect(repository.create(completed)).rejects.toBeInstanceOf(
      InvalidInitialWorkoutError,
    );
    expect(await repository.getActive()).toBeNull();
  });

  it("rejects malformed runtime events before they can corrupt storage", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-event-boundary-${crypto.randomUUID()}`),
    );
    const repository = new WorkoutRepository(database, () => 2_000);
    await repository.create(createWorkoutSession("session-1", snapshot));
    await repository.apply("session-1", { type: "start", at: 1_000 });

    await expect(
      repository.apply("session-1", {
        type: "complete_set",
        expectedPosition: { exerciseIndex: 0, setIndex: 0 },
        performedSetId: "performed-invalid",
        restTimerId: "rest-invalid",
        at: 2_000,
        actual: { kind: "reps", reps: -1, additionalWeightKg: null },
      }),
    ).rejects.toBeTruthy();

    expect(await repository.getActive()).toMatchObject({
      phase: { kind: "active_set" },
      performedSets: [],
    });
    expect(await database.activeRestTimers.count()).toBe(0);
  });
});

async function createRestingWorkout(repository: WorkoutRepository) {
  await repository.create(
    createWorkoutSession("session-1", snapshot),
  );
  await repository.apply("session-1", { type: "start", at: 1_000 });
  await repository.apply("session-1", {
    type: "complete_set",
    expectedPosition: { exerciseIndex: 0, setIndex: 0 },
    performedSetId: "performed-1",
    restTimerId: "rest-1",
    at: 2_000,
    actual: { kind: "reps", reps: 10, additionalWeightKg: null },
  });
}

function track(database: SetFlowDatabase) {
  openedDatabases.push(database);
  return database;
}
