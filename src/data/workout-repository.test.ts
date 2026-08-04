import { afterEach, describe, expect, it } from "vitest";
import { createWorkoutSession } from "../domain/workout/workout-machine";
import type {
  WorkoutEvent,
  WorkoutPlanSnapshot,
} from "../domain/workout/types";
import { SetFlowDatabase } from "./database";
import { ActiveWorkoutExistsError, WorkoutRepository } from "./workout-repository";

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
      notificationSync: "pending",
    });

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
    expect(restored?.performedSets).toHaveLength(1);
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
    expect(await repository.listReminderJobs()).toEqual([
      expect.objectContaining({
        id: "rest-1",
        revision: 1,
        status: "skipped",
        desiredNativeState: "canceled",
        notificationSync: "pending",
      }),
    ]);
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
    await repository.apply("session-1", {
      type: "adjust_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      deltaSeconds: 15,
      at: 10_000,
    });

    await expect(
      repository.markReminderApplied({
        timerId: "rest-1",
        expectedRevision: 0,
        desiredNativeState: "scheduled",
      }),
    ).resolves.toBe(false);
    expect((await repository.getActiveRest("session-1"))?.notificationSync).toBe(
      "pending",
    );

    await expect(
      repository.markReminderApplied({
        timerId: "rest-1",
        expectedRevision: 1,
        desiredNativeState: "scheduled",
      }),
    ).resolves.toBe(true);
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
        id: "rest-1",
        status: "finished",
        desiredNativeState: "canceled",
      }),
    ]);
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
      desiredNativeState: "scheduled",
      notificationSync: "pending",
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
