import { describe, expect, it } from "vitest";
import type {
  ExerciseDefinition,
  MuscleGroupId,
} from "../planning/types";
import { filterExercises } from "./exercise-filter";

type BrowsableExercise = ExerciseDefinition & {
  primaryMuscles: MuscleGroupId[];
  secondaryMuscles: MuscleGroupId[];
};

const exercises: BrowsableExercise[] = [
  {
    id: "strict-push-up",
    name: "标准俯卧撑",
    cue: "收紧核心，胸口整体下降后有力推起。",
    difficulty: "intermediate",
    movement: "push",
    requiredEquipment: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["arms"],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength"],
    defaultRestSeconds: 75,
  },
  {
    id: "dumbbell-floor-press",
    name: "哑铃地板卧推",
    cue: "肩胛贴稳地面，前臂保持垂直并平稳推起。",
    difficulty: "beginner",
    movement: "push",
    requiredEquipment: ["dumbbell"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["arms"],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength"],
    defaultRestSeconds: 60,
  },
  {
    id: "dumbbell-row",
    name: "单臂哑铃划船",
    cue: "背部保持稳定，把肘部贴近身体拉向髋部。",
    difficulty: "beginner",
    movement: "pull",
    requiredEquipment: ["dumbbell"],
    primaryMuscles: ["back"],
    secondaryMuscles: ["arms"],
    measure: { kind: "reps", basis: "per_side" },
    goals: ["general_fitness", "strength"],
    defaultRestSeconds: 60,
  },
];

describe("filterExercises", () => {
  it("filters by equipment and muscle while keeping bodyweight exercises available", () => {
    const result = filterExercises(exercises, {
      equipment: ["bodyweight", "dumbbell"],
      muscles: ["chest"],
    });

    expect(result.map((exercise) => exercise.id)).toEqual([
      "strict-push-up",
      "dumbbell-floor-press",
    ]);
  });
});
