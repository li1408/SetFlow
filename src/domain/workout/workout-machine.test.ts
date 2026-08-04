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
      sets: 2,
      target: { kind: "reps", min: 8, max: 12, basis: "total" },
      restSeconds: 60,
    },
    {
      id: "exercise-2",
      name: "平板支撑",
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
