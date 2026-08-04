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
