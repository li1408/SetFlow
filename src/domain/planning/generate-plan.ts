import type {
  ExerciseDefinition,
  ExperienceLevel,
  GeneratePlanResult,
  PlanGenerationInput,
  PlannedTarget,
  TrainingGoal,
} from "./types";

const RULE_VERSION = "1.0.0";

const difficultyRank: Record<ExperienceLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const movementRank: Record<ExerciseDefinition["movement"], number> = {
  squat: 0,
  hinge: 1,
  push: 2,
  pull: 3,
  lunge: 4,
  core: 5,
};

const goalRestSeconds: Record<TrainingGoal, number> = {
  general_fitness: 60,
  strength: 90,
  hypertrophy: 75,
  endurance: 45,
};

export function generatePlan(
  input: PlanGenerationInput,
  catalog: ExerciseDefinition[],
): GeneratePlanResult {
  const availableEquipment = new Set(input.availableEquipment);
  const maximumDifficulty = difficultyRank[input.experience];

  const compatibleExercises = catalog
    .filter(
      (exercise) =>
        difficultyRank[exercise.difficulty] <= maximumDifficulty &&
        exercise.goals.includes(input.goal) &&
        exercise.requiredEquipment.every((equipment) =>
          availableEquipment.has(equipment),
        ),
    )
    .sort(
      (left, right) =>
        movementRank[left.movement] - movementRank[right.movement] ||
        left.id.localeCompare(right.id),
    );

  if (compatibleExercises.length === 0) {
    return { ok: false, error: { code: "NO_COMPATIBLE_EXERCISES" } };
  }

  const exerciseCount = Math.min(
    compatibleExercises.length,
    exercisesPerSession(input.sessionMinutes),
  );
  const days = Array.from({ length: input.daysPerWeek }, (_, dayIndex) => {
    const rotation = dayIndex % compatibleExercises.length;
    const rotated = [
      ...compatibleExercises.slice(rotation),
      ...compatibleExercises.slice(0, rotation),
    ];

    return {
      ordinal: dayIndex + 1,
      name: `全身训练 ${String.fromCharCode(65 + dayIndex)}`,
      exercises: rotated.slice(0, exerciseCount).map((exercise, order) => ({
        exerciseId: exercise.id,
        order,
        sets: setsFor(input.experience, input.goal),
        target: targetFor(exercise, input.goal, input.experience),
        restSeconds: Math.max(
          exercise.defaultRestSeconds,
          goalRestSeconds[input.goal],
        ),
      })),
    };
  });

  return {
    ok: true,
    plan: {
      source: {
        kind: "generated",
        ruleVersion: RULE_VERSION,
        input: {
          ...input,
          availableEquipment: [...input.availableEquipment],
        },
      },
      days,
    },
  };
}

function exercisesPerSession(sessionMinutes: number): number {
  if (sessionMinutes <= 20) return 3;
  if (sessionMinutes <= 35) return 4;
  if (sessionMinutes <= 50) return 5;
  return 6;
}

function setsFor(experience: ExperienceLevel, goal: TrainingGoal): number {
  if (experience === "beginner") return 2;
  if (goal === "strength" && experience === "advanced") return 4;
  return 3;
}

function targetFor(
  exercise: ExerciseDefinition,
  goal: TrainingGoal,
  experience: ExperienceLevel,
): PlannedTarget {
  if (exercise.measure.kind === "durationSeconds") {
    const secondsByExperience: Record<ExperienceLevel, number> = {
      beginner: 30,
      intermediate: 40,
      advanced: 50,
    };
    return {
      kind: "durationSeconds",
      seconds: secondsByExperience[experience],
      basis: exercise.measure.basis,
    };
  }

  const rangeByGoal: Record<TrainingGoal, { min: number; max: number }> = {
    general_fitness: { min: 8, max: 12 },
    strength: { min: 5, max: 8 },
    hypertrophy: { min: 8, max: 12 },
    endurance: { min: 12, max: 18 },
  };

  return {
    kind: "reps",
    ...rangeByGoal[goal],
    basis: exercise.measure.basis,
  };
}
