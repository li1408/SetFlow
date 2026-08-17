import { describe, expect, it } from "vitest";
import { createWorkoutSession, transitionWorkout } from "./workout-machine";
import type { WorkoutPlanSnapshot } from "./types";

const snapshot: WorkoutPlanSnapshot = {
  planId: "plan-1",
  planName: "居家基础",
  exercises: [
    {
      id: "exercise-1",
      name: "徒手深蹲",
      cue: "脚掌稳稳踩地，膝盖跟随脚尖方向下蹲。",
      sets: 2,
      target: { kind: "reps", min: 8, max: 12, basis: "total" },
      restSeconds: 60,
    },
    {
      id: "exercise-2",
      name: "平板支撑",
      cue: "肘在肩下，收紧臀腹并保持自然呼吸。",
      sets: 1,
      target: {
        kind: "durationSeconds",
        seconds: 30,
        basis: "total",
      },
      restSeconds: 45,
    },
  ],
};

describe("workout state machine", () => {
  it("starts at the first set", () => {
    const idle = createWorkoutSession("session-1", snapshot);
    const result = transitionWorkout(idle, { type: "start", at: 1_000 });

    expect(result.kind).toBe("changed");
    if (result.kind === "changed") {
      expect(result.state.phase).toEqual({
        kind: "active_set",
        position: { exerciseIndex: 0, setIndex: 0 },
      });
      expect(result.state.activeExerciseStartedAt).toBe(1_000);
      expect(result.facts).toEqual([{ type: "WORKOUT_STARTED" }]);
    }
  });

  it("records a set once and starts rest for the next set", () => {
    const idle = createWorkoutSession("session-1", snapshot);
    const started = transitionWorkout(idle, { type: "start", at: 1_000 });
    if (started.kind !== "changed") throw new Error("workout did not start");

    const event = {
      type: "complete_set" as const,
      expectedPosition: { exerciseIndex: 0, setIndex: 0 },
      performedSetId: "performed-1",
      restTimerId: "rest-1",
      at: 2_000,
      actual: { kind: "reps" as const, reps: 10, additionalWeightKg: null },
    };
    const completed = transitionWorkout(started.state, event);

    expect(completed.kind).toBe("changed");
    if (completed.kind === "changed") {
      expect(completed.state.performedSets).toHaveLength(1);
      expect(completed.state.phase).toMatchObject({
        kind: "resting",
        nextPosition: { exerciseIndex: 0, setIndex: 1 },
        timer: { id: "rest-1", revision: 0, endsAt: 62_000 },
      });
      expect(completed.facts.map((fact) => fact.type)).toEqual([
        "SET_COMPLETED",
        "REST_STARTED",
      ]);

      const replayed = transitionWorkout(completed.state, event);
      expect(replayed).toMatchObject({
        kind: "noop",
        reason: "DUPLICATE_SET",
      });
      expect(replayed.state.performedSets).toHaveLength(1);
    }
  });

  it("only finishes rest when the current timer is due", () => {
    const resting = createRestingSession();

    expect(
      transitionWorkout(resting, {
        type: "rest_elapsed",
        timerId: "rest-1",
        expectedRevision: 0,
        at: 61_999,
      }),
    ).toMatchObject({ kind: "noop", reason: "REST_NOT_DUE" });

    const elapsed = transitionWorkout(resting, {
      type: "rest_elapsed",
      timerId: "rest-1",
      expectedRevision: 0,
      at: 62_000,
    });
    expect(elapsed).toMatchObject({
      kind: "changed",
      state: {
        phase: {
          kind: "next_set_ready",
          position: { exerciseIndex: 0, setIndex: 1 },
        },
      },
      facts: [{ type: "REST_FINISHED", timerId: "rest-1" }],
    });
    if (elapsed.kind === "changed") {
      expect(elapsed.state.activeExerciseStartedAt).toBe(1_000);
      expect(
        transitionWorkout(elapsed.state, {
          type: "rest_elapsed",
          timerId: "rest-1",
          expectedRevision: 0,
          at: 62_001,
        }),
      ).toMatchObject({ kind: "noop", reason: "STALE_TIMER" });
    }
  });

  it("starts a fresh action timer when rest advances to another exercise", () => {
    const firstExerciseCompleted = transitionWorkout(createRestingSession(), {
      type: "rest_elapsed",
      timerId: "rest-1",
      expectedRevision: 0,
      at: 62_000,
    });
    if (firstExerciseCompleted.kind !== "changed") {
      throw new Error("rest did not finish");
    }

    const secondSetActive = transitionWorkout(firstExerciseCompleted.state, {
      type: "activate_next_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 1 },
    });
    if (secondSetActive.kind !== "changed") {
      throw new Error("second set did not activate");
    }

    const completedSecondSet = transitionWorkout(secondSetActive.state, {
      type: "complete_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 1 },
      performedSetId: "performed-2",
      restTimerId: "rest-2",
      at: 70_000,
      actual: { kind: "reps", reps: 10, additionalWeightKg: null },
    });
    if (completedSecondSet.kind !== "changed") {
      throw new Error("second set did not complete");
    }

    const nextExerciseReady = transitionWorkout(completedSecondSet.state, {
      type: "rest_elapsed",
      timerId: "rest-2",
      expectedRevision: 0,
      at: 130_000,
    });

    expect(nextExerciseReady).toMatchObject({
      kind: "changed",
      state: {
        activeExerciseStartedAt: 130_000,
        phase: {
          kind: "next_set_ready",
          position: { exerciseIndex: 1, setIndex: 0 },
        },
      },
    });
  });

  it("reschedules rest from the current revision and rejects stale repeats", () => {
    const resting = createRestingSession();
    const adjusted = transitionWorkout(resting, {
      type: "adjust_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      deltaSeconds: 15,
      at: 10_000,
    });

    expect(adjusted).toMatchObject({
      kind: "changed",
      state: {
        phase: {
          kind: "resting",
          timer: {
            revision: 1,
            endsAt: 77_000,
            totalAdjustmentSeconds: 15,
          },
        },
      },
      facts: [{ type: "REST_RESCHEDULED" }],
    });
    if (adjusted.kind === "changed") {
      expect(
        transitionWorkout(adjusted.state, {
          type: "adjust_rest",
          timerId: "rest-1",
          expectedRevision: 0,
          deltaSeconds: 15,
          at: 10_100,
        }),
      ).toMatchObject({ kind: "noop", reason: "STALE_REVISION" });
    }
  });

  it("finishes rest immediately when subtracting past the remaining time", () => {
    const result = transitionWorkout(createRestingSession(), {
      type: "adjust_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      deltaSeconds: -15,
      at: 50_000,
    });

    expect(result).toMatchObject({
      kind: "changed",
      state: {
        phase: {
          kind: "next_set_ready",
          position: { exerciseIndex: 0, setIndex: 1 },
        },
      },
      facts: [{ type: "REST_FINISHED", timerId: "rest-1" }],
    });
  });

  it("skips rest and explicitly activates the next set", () => {
    const skipped = transitionWorkout(createRestingSession(), {
      type: "skip_rest",
      timerId: "rest-1",
      expectedRevision: 0,
      at: 20_000,
    });

    expect(skipped).toMatchObject({
      kind: "changed",
      state: {
        phase: {
          kind: "next_set_ready",
          position: { exerciseIndex: 0, setIndex: 1 },
        },
      },
      facts: [{ type: "REST_SKIPPED", timerId: "rest-1" }],
    });
    if (skipped.kind !== "changed") throw new Error("rest was not skipped");

    const activated = transitionWorkout(skipped.state, {
      type: "activate_next_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 1 },
    });
    expect(activated).toMatchObject({
      kind: "changed",
      state: {
        phase: {
          kind: "active_set",
          position: { exerciseIndex: 0, setIndex: 1 },
        },
      },
      facts: [],
    });
  });

  it("completes the workout without starting rest after the final set", () => {
    const finalSetSession = createWorkoutSession("session-final", {
      ...snapshot,
      exercises: [snapshot.exercises[1]!],
    });
    const started = transitionWorkout(finalSetSession, {
      type: "start",
      at: 1_000,
    });
    if (started.kind !== "changed") throw new Error("workout did not start");

    const completed = transitionWorkout(started.state, {
      type: "complete_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 0 },
      performedSetId: "performed-final",
      restTimerId: "unused-rest",
      at: 32_000,
      actual: { kind: "durationSeconds", seconds: 30 },
    });

    expect(completed).toMatchObject({
      kind: "changed",
      state: { phase: { kind: "completed", completedAt: 32_000 } },
    });
    if (completed.kind === "changed") {
      expect(completed.facts.map((fact) => fact.type)).toEqual([
        "SET_COMPLETED",
        "WORKOUT_COMPLETED",
      ]);
    }
  });
});

function createRestingSession() {
  const idle = createWorkoutSession("session-1", snapshot);
  const started = transitionWorkout(idle, { type: "start", at: 1_000 });
  if (started.kind !== "changed") throw new Error("workout did not start");

  const completed = transitionWorkout(started.state, {
    type: "complete_set",
    expectedPosition: { exerciseIndex: 0, setIndex: 0 },
    performedSetId: "performed-1",
    restTimerId: "rest-1",
    at: 2_000,
    actual: { kind: "reps", reps: 10, additionalWeightKg: null },
  });
  if (completed.kind !== "changed") throw new Error("set was not completed");
  return completed.state;
}
