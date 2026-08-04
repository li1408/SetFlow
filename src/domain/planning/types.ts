export type TrainingGoal =
  | "general_fitness"
  | "strength"
  | "hypertrophy"
  | "endurance";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type EquipmentId =
  | "mat"
  | "resistance_band"
  | "dumbbell"
  | "kettlebell"
  | "pull_up_bar"
  | "bench";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "lunge"
  | "core";

export type ExerciseMeasure = {
  kind: "reps" | "durationSeconds";
  basis: "total" | "per_side";
};

export interface ExerciseDefinition {
  id: string;
  name: string;
  cue: string;
  difficulty: ExperienceLevel;
  movement: MovementPattern;
  requiredEquipment: EquipmentId[];
  measure: ExerciseMeasure;
  goals: TrainingGoal[];
  defaultRestSeconds: number;
}

export interface PlanGenerationInput {
  goal: TrainingGoal;
  daysPerWeek: number;
  experience: ExperienceLevel;
  availableEquipment: EquipmentId[];
  sessionMinutes: number;
}

export type PlannedTarget =
  | {
      kind: "reps";
      min: number;
      max: number;
      basis: ExerciseMeasure["basis"];
    }
  | {
      kind: "durationSeconds";
      seconds: number;
      basis: ExerciseMeasure["basis"];
    };

export interface PlannedExerciseDraft {
  exerciseId: string;
  order: number;
  sets: number;
  target: PlannedTarget;
  restSeconds: number;
}

export interface GeneratedPlanDraft {
  source: {
    kind: "generated";
    ruleVersion: string;
  };
  days: PlanDayDraft[];
}

export interface ManualPlanDraft {
  source: { kind: "manual" };
  days: PlanDayDraft[];
}

export interface PlanDayDraft {
  ordinal: number;
  name: string;
  exercises: PlannedExerciseDraft[];
}

export type PlanDraft = GeneratedPlanDraft | ManualPlanDraft;

export type GeneratePlanResult =
  | { ok: true; plan: GeneratedPlanDraft }
  | {
      ok: false;
      error: { code: "NO_COMPATIBLE_EXERCISES" };
    };
