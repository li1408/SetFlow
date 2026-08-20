import { z } from "zod";
import type {
  WorkoutEvent,
  WorkoutSession,
} from "../domain/workout/types";

const idSchema = z.string().min(1).max(128);
const timestampSchema = z.number().int().nonnegative();
const positionSchema = z.strictObject({
  exerciseIndex: z.number().int().nonnegative(),
  setIndex: z.number().int().nonnegative(),
});
const basisSchema = z.enum(["total", "per_side"]);

const plannedTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("reps"),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    basis: basisSchema,
  }),
  z.strictObject({
    kind: z.literal("durationSeconds"),
    seconds: z.number().int().positive(),
    basis: basisSchema,
  }),
]);

const actualSetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("reps"),
    reps: z.number().int().nonnegative(),
    additionalWeightKg: z.number().nonnegative().nullable(),
  }),
  z.strictObject({
    kind: z.literal("durationSeconds"),
    seconds: z.number().int().nonnegative(),
  }),
]);

const workoutEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("start"), at: timestampSchema }),
  z.strictObject({
    type: z.literal("complete_set"),
    expectedPosition: positionSchema,
    performedSetId: idSchema,
    restTimerId: idSchema,
    at: timestampSchema,
    actual: actualSetSchema,
  }),
  z.strictObject({
    type: z.literal("rest_elapsed"),
    timerId: idSchema,
    expectedRevision: z.number().int().nonnegative(),
    at: timestampSchema,
  }),
  z.strictObject({
    type: z.literal("adjust_rest"),
    timerId: idSchema,
    expectedRevision: z.number().int().nonnegative(),
    deltaSeconds: z.union([z.literal(-15), z.literal(15)]),
    at: timestampSchema,
  }),
  z.strictObject({
    type: z.literal("skip_rest"),
    timerId: idSchema,
    expectedRevision: z.number().int().nonnegative(),
    at: timestampSchema,
  }),
  z.strictObject({
    type: z.literal("activate_next_set"),
    expectedPosition: positionSchema,
  }),
]);

const restTimerSchema = z.strictObject({
  id: idSchema,
  revision: z.number().int().nonnegative(),
  sourceSetId: idSchema,
  startedAt: timestampSchema,
  endsAt: timestampSchema,
  totalAdjustmentSeconds: z.number().int(),
});

const workoutPhaseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("idle") }),
  z.strictObject({ kind: z.literal("active_set"), position: positionSchema }),
  z.strictObject({
    kind: z.literal("resting"),
    completedPosition: positionSchema,
    nextPosition: positionSchema,
    timer: restTimerSchema,
  }),
  z.strictObject({
    kind: z.literal("next_set_ready"),
    position: positionSchema,
  }),
  z.strictObject({ kind: z.literal("completed"), completedAt: timestampSchema }),
]);

const workoutSessionSchema = z.strictObject({
  id: idSchema,
  snapshot: z.strictObject({
    planId: idSchema,
    planName: z.string().trim().min(1).max(80),
    exercises: z
      .array(
        z.strictObject({
          id: idSchema,
          name: z.string().trim().min(1).max(80),
          cue: z.string().trim().min(8).max(48),
          sets: z.number().int().min(1).max(20),
          target: plannedTargetSchema,
          restSeconds: z.number().int().min(0).max(600),
        }),
      )
      .min(1)
      .max(40),
  }),
  phase: workoutPhaseSchema,
  performedSets: z.array(
    z.strictObject({
      id: idSchema,
      exerciseId: idSchema,
      position: positionSchema,
      target: plannedTargetSchema,
      actual: actualSetSchema,
      completedAt: timestampSchema,
    }),
  ),
  startedAt: timestampSchema.nullable(),
  activeExerciseStartedAt: timestampSchema.nullable().optional().default(null),
});

export function parseWorkoutSession(input: unknown): WorkoutSession {
  return workoutSessionSchema.parse(input) as WorkoutSession;
}

export function parseWorkoutEvent(input: unknown): WorkoutEvent {
  return workoutEventSchema.parse(input) as WorkoutEvent;
}
