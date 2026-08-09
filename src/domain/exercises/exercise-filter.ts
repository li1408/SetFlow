import type {
  EquipmentId,
  ExerciseDefinition,
  MuscleGroupId,
} from "../planning/types";

export type ExerciseEquipmentFilter = "bodyweight" | EquipmentId;

export interface BrowsableExercise extends ExerciseDefinition {
  primaryMuscles: MuscleGroupId[];
  secondaryMuscles: MuscleGroupId[];
}

export interface ExerciseFilter {
  equipment: ExerciseEquipmentFilter[];
  muscles: MuscleGroupId[];
}

export function filterExercises<T extends BrowsableExercise>(
  exercises: readonly T[],
  filter: ExerciseFilter,
): T[] {
  const availableEquipment = new Set(filter.equipment);
  const selectedMuscles = new Set(filter.muscles);
  const acceptsEveryMuscle =
    selectedMuscles.size === 0 || selectedMuscles.has("full_body");

  return exercises.filter((exercise) => {
    const hasEquipment =
      exercise.requiredEquipment.length === 0
        ? availableEquipment.has("bodyweight")
        : exercise.requiredEquipment.every((equipment) =>
            availableEquipment.has(equipment),
          );
    if (!hasEquipment) return false;

    return (
      acceptsEveryMuscle ||
      exercise.primaryMuscles.some((muscle) => selectedMuscles.has(muscle)) ||
      exercise.secondaryMuscles.some((muscle) => selectedMuscles.has(muscle))
    );
  });
}
