import { describe, expect, it } from "vitest";
import { generatePlan } from "../planning/generate-plan";
import type {
  ExerciseDefinition,
  MovementPattern,
} from "../planning/types";
import { builtInExerciseCatalog } from "./built-in-catalog";

const allMovementPatterns: MovementPattern[] = [
  "squat",
  "hinge",
  "push",
  "pull",
  "lunge",
  "core",
];

describe("builtInExerciseCatalog", () => {
  it("uses unique stable ids and original Chinese names", () => {
    const ids = builtInExerciseCatalog.map((exercise) => exercise.id);
    const names = builtInExerciseCatalog.map((exercise) => exercise.name);

    expect(builtInExerciseCatalog.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(
      true,
    );
    expect(names.every((name) => /[\u3400-\u9fff]/u.test(name))).toBe(true);
  });

  it("covers squat, hinge, push, pull, lunge and core patterns", () => {
    const coveredPatterns = new Set(
      builtInExerciseCatalog.map((exercise) => exercise.movement),
    );

    expect(coveredPatterns).toEqual(new Set(allMovementPatterns));
  });

  it("keeps every pull exercise honest about its required equipment", () => {
    const pullExercises = builtInExerciseCatalog.filter(
      (exercise) => exercise.movement === "pull",
    );

    expect(pullExercises.length).toBeGreaterThanOrEqual(2);
    expect(
      pullExercises.every((exercise) => exercise.requiredEquipment.length > 0),
    ).toBe(true);
    expect(
      pullExercises.some(
        (exercise) =>
          exercise.id === "low-bar-inverted-row" &&
          exercise.requiredEquipment.includes("pull_up_bar"),
      ),
    ).toBe(true);
  });

  it("can generate a beginner plan without selecting equipment exercises", () => {
    const result = generatePlan(
      {
        goal: "general_fitness",
        daysPerWeek: 3,
        experience: "beginner",
        availableEquipment: [],
        sessionMinutes: 30,
      },
      builtInExerciseCatalog,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const catalogById = new Map<string, ExerciseDefinition>(
        builtInExerciseCatalog.map((exercise) => [exercise.id, exercise]),
      );
      const selectedExercises = result.plan.days.flatMap((day) =>
        day.exercises.map((exercise) => catalogById.get(exercise.exerciseId)),
      );

      expect(selectedExercises.every(Boolean)).toBe(true);
      expect(
        selectedExercises.every(
          (exercise) => exercise?.requiredEquipment.length === 0,
        ),
      ).toBe(true);
    }
  });

  it("uses rest values compatible with the 15-second timer controls", () => {
    expect(
      builtInExerciseCatalog.every(
        (exercise) =>
          exercise.defaultRestSeconds >= 30 &&
          exercise.defaultRestSeconds <= 120 &&
          exercise.defaultRestSeconds % 15 === 0,
      ),
    ).toBe(true);
  });

  it("includes a concise movement cue that can be frozen into workout history", () => {
    expect(
      builtInExerciseCatalog.every(
        (exercise) =>
          typeof exercise.cue === "string" &&
          exercise.cue.trim().length >= 8 &&
          exercise.cue.length <= 48,
      ),
    ).toBe(true);
  });
});
