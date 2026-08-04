import type {
  PerformedSet,
  WorkoutEvent,
  WorkoutPlanSnapshot,
  WorkoutPosition,
  WorkoutSession,
  WorkoutTransition,
} from "./types";

export function createWorkoutSession(
  id: string,
  snapshot: WorkoutPlanSnapshot,
): WorkoutSession {
  return {
    id,
    snapshot,
    phase: { kind: "idle" },
    performedSets: [],
    startedAt: null,
  };
}

export function transitionWorkout(
  state: WorkoutSession,
  event: WorkoutEvent,
): WorkoutTransition {
  if (event.type === "start") {
    if (state.phase.kind !== "idle" || state.snapshot.exercises.length === 0) {
      return rejected(state, "INVALID_TRANSITION");
    }

    return {
      kind: "changed",
      state: {
        ...state,
        phase: {
          kind: "active_set",
          position: { exerciseIndex: 0, setIndex: 0 },
        },
        startedAt: event.at,
      },
      facts: [{ type: "WORKOUT_STARTED" }],
    };
  }

  if (event.type === "complete_set") {
    if (state.performedSets.some((set) => set.id === event.performedSetId)) {
      return { kind: "noop", state, reason: "DUPLICATE_SET" };
    }
    if (
      state.phase.kind !== "active_set" ||
      !samePosition(state.phase.position, event.expectedPosition)
    ) {
      return rejected(state, "INVALID_TRANSITION");
    }

    const exercise = state.snapshot.exercises[event.expectedPosition.exerciseIndex];
    if (!exercise) return rejected(state, "INVALID_TRANSITION");
    if (exercise.target.kind !== event.actual.kind) {
      return rejected(state, "MEASUREMENT_KIND_MISMATCH");
    }

    const performedSet: PerformedSet = {
      id: event.performedSetId,
      exerciseId: exercise.id,
      position: event.expectedPosition,
      target: exercise.target,
      actual: event.actual,
      completedAt: event.at,
    };
    const performedSets = [...state.performedSets, performedSet];
    const nextPosition = getNextPosition(state.snapshot, event.expectedPosition);

    if (!nextPosition) {
      return {
        kind: "changed",
        state: {
          ...state,
          performedSets,
          phase: { kind: "completed", completedAt: event.at },
        },
        facts: [
          { type: "SET_COMPLETED", performedSetId: performedSet.id },
          { type: "WORKOUT_COMPLETED" },
        ],
      };
    }

    const timer = {
      id: event.restTimerId,
      revision: 0,
      sourceSetId: performedSet.id,
      startedAt: event.at,
      endsAt: event.at + exercise.restSeconds * 1_000,
      totalAdjustmentSeconds: 0,
    };

    return {
      kind: "changed",
      state: {
        ...state,
        performedSets,
        phase: {
          kind: "resting",
          completedPosition: event.expectedPosition,
          nextPosition,
          timer,
        },
      },
      facts: [
        { type: "SET_COMPLETED", performedSetId: performedSet.id },
        { type: "REST_STARTED", timer },
      ],
    };
  }

  if (state.phase.kind !== "resting") {
    return rejected(state, "INVALID_TRANSITION");
  }
  if (state.phase.timer.id !== event.timerId) {
    return { kind: "noop", state, reason: "STALE_TIMER" };
  }
  if (state.phase.timer.revision !== event.expectedRevision) {
    return { kind: "noop", state, reason: "STALE_REVISION" };
  }
  if (event.at < state.phase.timer.endsAt) {
    return { kind: "noop", state, reason: "REST_NOT_DUE" };
  }

  return {
    kind: "changed",
    state: {
      ...state,
      phase: {
        kind: "next_set_ready",
        position: state.phase.nextPosition,
      },
    },
    facts: [{ type: "REST_FINISHED", timerId: state.phase.timer.id }],
  };
}

function getNextPosition(
  snapshot: WorkoutPlanSnapshot,
  current: WorkoutPosition,
): WorkoutPosition | null {
  const exercise = snapshot.exercises[current.exerciseIndex];
  if (!exercise) return null;

  if (current.setIndex + 1 < exercise.sets) {
    return { exerciseIndex: current.exerciseIndex, setIndex: current.setIndex + 1 };
  }

  if (current.exerciseIndex + 1 < snapshot.exercises.length) {
    return { exerciseIndex: current.exerciseIndex + 1, setIndex: 0 };
  }

  return null;
}

function samePosition(left: WorkoutPosition, right: WorkoutPosition): boolean {
  return (
    left.exerciseIndex === right.exerciseIndex && left.setIndex === right.setIndex
  );
}

function rejected(
  state: WorkoutSession,
  code: "INVALID_TRANSITION" | "MEASUREMENT_KIND_MISMATCH",
): WorkoutTransition {
  return { kind: "rejected", state, error: { code } };
}
