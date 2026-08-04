import { describe, expect, it } from "vitest";
import {
  exerciseDefinitionSchema,
  planGenerationInputSchema,
} from "./schemas";

describe("planGenerationInputSchema", () => {
  it("accepts a supported offline plan request", () => {
    const result = planGenerationInputSchema.safeParse({
      goal: "general_fitness",
      daysPerWeek: 3,
      experience: "beginner",
      availableEquipment: ["mat", "resistance_band"],
      sessionMinutes: 30,
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["too few days", { daysPerWeek: 1 }],
    ["too many days", { daysPerWeek: 7 }],
    ["session too short", { sessionMinutes: 14 }],
    ["session too long", { sessionMinutes: 91 }],
    ["unknown equipment", { availableEquipment: ["cable_machine"] }],
  ])("rejects %s", (_label, override) => {
    const result = planGenerationInputSchema.safeParse({
      goal: "general_fitness",
      daysPerWeek: 3,
      experience: "beginner",
      availableEquipment: [],
      sessionMinutes: 30,
      ...override,
    });

    expect(result.success).toBe(false);
  });
});

describe("exerciseDefinitionSchema", () => {
  it("rejects unsafe identifiers and implausible rest durations", () => {
    const baseExercise = {
      id: "bodyweight-squat",
      name: "徒手深蹲",
      cue: "脚掌稳稳踩地，膝盖跟随脚尖方向下蹲。",
      difficulty: "beginner",
      movement: "squat",
      requiredEquipment: [],
      measure: { kind: "reps", basis: "total" },
      goals: ["general_fitness"],
      defaultRestSeconds: 60,
    };

    expect(
      exerciseDefinitionSchema.safeParse({ ...baseExercise, id: "../squat" })
        .success,
    ).toBe(false);
    expect(
      exerciseDefinitionSchema.safeParse({
        ...baseExercise,
        defaultRestSeconds: 601,
      }).success,
    ).toBe(false);
  });

  it("accepts an equipment-free duration exercise", () => {
    const result = exerciseDefinitionSchema.safeParse({
      id: "front-plank",
      name: "平板支撑",
      cue: "肘在肩下，收紧臀腹并保持自然呼吸。",
      difficulty: "beginner",
      movement: "core",
      requiredEquipment: [],
      measure: { kind: "durationSeconds", basis: "total" },
      goals: ["general_fitness", "endurance"],
      defaultRestSeconds: 45,
    });

    expect(result.success).toBe(true);
  });
});
