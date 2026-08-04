import { z } from "zod";

const trainingGoalSchema = z.enum([
  "general_fitness",
  "strength",
  "hypertrophy",
  "endurance",
]);

const experienceLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

const equipmentIdSchema = z.enum([
  "mat",
  "resistance_band",
  "dumbbell",
  "kettlebell",
  "pull_up_bar",
  "bench",
]);

const uniqueEquipmentSchema = z
  .array(equipmentIdSchema)
  .max(6)
  .refine((items) => new Set(items).size === items.length, {
    message: "器械不能重复",
  });

export const planGenerationInputSchema = z.strictObject({
  goal: trainingGoalSchema,
  daysPerWeek: z.number().int().min(2).max(6),
  experience: experienceLevelSchema,
  availableEquipment: uniqueEquipmentSchema,
  sessionMinutes: z.number().int().min(15).max(90),
});

export const exerciseDefinitionSchema = z.strictObject({
  id: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(40),
  cue: z.string().trim().min(8).max(48),
  difficulty: experienceLevelSchema,
  movement: z.enum(["squat", "hinge", "push", "pull", "lunge", "core"]),
  requiredEquipment: uniqueEquipmentSchema,
  measure: z.strictObject({
    kind: z.enum(["reps", "durationSeconds"]),
    basis: z.enum(["total", "per_side"]),
  }),
  goals: z.array(trainingGoalSchema).min(1).max(4),
  defaultRestSeconds: z.number().int().min(15).max(600),
});

const plannedTargetSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      kind: z.literal("reps"),
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
      basis: z.enum(["total", "per_side"]),
    })
    .refine((target) => target.min <= target.max, {
      message: "最小次数不能大于最大次数",
    }),
  z.strictObject({
    kind: z.literal("durationSeconds"),
    seconds: z.number().int().positive().max(3_600),
    basis: z.enum(["total", "per_side"]),
  }),
]);

export const generatedPlanDraftSchema = z.strictObject({
  source: z.strictObject({
    kind: z.literal("generated"),
    ruleVersion: z.string().min(1).max(32),
  }),
  days: z
    .array(
      z.strictObject({
        ordinal: z.number().int().positive().max(7),
        name: z.string().trim().min(1).max(80),
        exercises: z
          .array(
            z.strictObject({
              exerciseId: z.string().min(1).max(128),
              order: z.number().int().nonnegative(),
              sets: z.number().int().min(1).max(20),
              target: plannedTargetSchema,
              restSeconds: z.number().int().min(0).max(600),
            }),
          )
          .min(1)
          .max(30),
      }),
    )
    .min(1)
    .max(7),
});
