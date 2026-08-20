import type { MuscleGroupId } from "../../domain/planning/types";

export const OriginalMuscle = {
  ABDOMINALS: "abdominals",
  BACK: "back",
  BICEPS: "biceps",
  CALVES: "calves",
  CHEST: "chest",
  FOREARMS: "forearms",
  GLUTES: "glutes",
  HAMSTRINGS: "hamstrings",
  OBLIQUES: "obliques",
  QUADRICEPS: "quadriceps",
  SHOULDERS: "shoulders",
  TRAPS: "traps",
  TRICEPS: "triceps",
} as const;

export type OriginalMuscleId =
  (typeof OriginalMuscle)[keyof typeof OriginalMuscle];

export interface OriginalMuscleChoice {
  id: OriginalMuscleId;
  label: string;
  exerciseGroups: readonly MuscleGroupId[];
}

export const originalMuscleChoices: readonly OriginalMuscleChoice[] = [
  { id: OriginalMuscle.CHEST, label: "胸部", exerciseGroups: ["chest"] },
  { id: OriginalMuscle.BACK, label: "背部", exerciseGroups: ["back"] },
  {
    id: OriginalMuscle.SHOULDERS,
    label: "肩部",
    exerciseGroups: ["shoulders"],
  },
  { id: OriginalMuscle.BICEPS, label: "二头肌", exerciseGroups: ["arms"] },
  { id: OriginalMuscle.TRICEPS, label: "三头肌", exerciseGroups: ["arms"] },
  { id: OriginalMuscle.FOREARMS, label: "前臂", exerciseGroups: ["arms"] },
  { id: OriginalMuscle.ABDOMINALS, label: "腹肌", exerciseGroups: ["core"] },
  { id: OriginalMuscle.OBLIQUES, label: "腹斜肌", exerciseGroups: ["core"] },
  { id: OriginalMuscle.GLUTES, label: "臀部", exerciseGroups: ["glutes"] },
  {
    id: OriginalMuscle.QUADRICEPS,
    label: "股四头肌",
    exerciseGroups: ["legs"],
  },
  {
    id: OriginalMuscle.HAMSTRINGS,
    label: "腘绳肌",
    exerciseGroups: ["legs", "glutes"],
  },
  { id: OriginalMuscle.CALVES, label: "小腿", exerciseGroups: ["legs"] },
  {
    id: OriginalMuscle.TRAPS,
    label: "斜方肌",
    exerciseGroups: ["back", "shoulders"],
  },
];

export const originalMuscleLabels: Record<OriginalMuscleId, string> =
  Object.fromEntries(
    originalMuscleChoices.map((choice) => [choice.id, choice.label]),
  ) as Record<OriginalMuscleId, string>;

export const originalMuscleExerciseGroups: Record<
  OriginalMuscleId,
  readonly MuscleGroupId[]
> = Object.fromEntries(
  originalMuscleChoices.map((choice) => [choice.id, choice.exerciseGroups]),
) as Record<OriginalMuscleId, readonly MuscleGroupId[]>;

export function mapOriginalMusclesToExerciseGroups(
  muscles: readonly OriginalMuscleId[],
): MuscleGroupId[] {
  return [
    ...new Set(
      muscles.flatMap((muscle) => originalMuscleExerciseGroups[muscle]),
    ),
  ];
}
