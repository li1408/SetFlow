import { describe, expect, it } from "vitest";
import { generatePlan } from "./generate-plan";
import type { ExerciseDefinition, PlanGenerationInput } from "./types";

const catalog: ExerciseDefinition[] = [
  {
    id: "bodyweight-squat",
    name: "徒手深蹲",
    difficulty: "beginner",
    movement: "squat",
    requiredEquipment: [],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength", "hypertrophy", "endurance"],
    defaultRestSeconds: 60,
  },
  {
    id: "incline-push-up",
    name: "上斜俯卧撑",
    difficulty: "beginner",
    movement: "push",
    requiredEquipment: [],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength", "hypertrophy"],
    defaultRestSeconds: 60,
  },
  {
    id: "dead-bug",
    name: "死虫式",
    difficulty: "beginner",
    movement: "core",
    requiredEquipment: [],
    measure: { kind: "durationSeconds", basis: "total" },
    goals: ["general_fitness", "endurance"],
    defaultRestSeconds: 45,
  },
  {
    id: "dumbbell-row",
    name: "单臂哑铃划船",
    difficulty: "beginner",
    movement: "pull",
    requiredEquipment: ["dumbbell"],
    measure: { kind: "reps", basis: "per_side" },
    goals: ["general_fitness", "strength", "hypertrophy"],
    defaultRestSeconds: 75,
  },
];

const input: PlanGenerationInput = {
  goal: "general_fitness",
  daysPerWeek: 3,
  experience: "beginner",
  availableEquipment: [],
  sessionMinutes: 30,
};

describe("generatePlan", () => {
  it("returns the same non-empty plan regardless of catalog order", () => {
    const forward = generatePlan(input, catalog);
    const reversed = generatePlan(input, [...catalog].reverse());

    expect(forward).toEqual(reversed);
    expect(forward.ok).toBe(true);
    if (forward.ok) {
      expect(forward.plan.days).toHaveLength(3);
      expect(forward.plan.days[0]?.exercises.length).toBeGreaterThan(0);
    }
  });

  it("only selects bodyweight exercises when no equipment is available", () => {
    const result = generatePlan(input, catalog);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const selectedIds = result.plan.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.exerciseId),
      );
      expect(selectedIds).not.toContain("dumbbell-row");
    }
  });

  it("returns a structured error when no exercise is compatible", () => {
    const result = generatePlan(input, [catalog[3]!]);

    expect(result).toEqual({
      ok: false,
      error: { code: "NO_COMPATIBLE_EXERCISES" },
    });
  });
});
