import { useId, useState, type FormEvent } from "react";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { planDraftSchema } from "../../domain/planning/schemas";
import type {
  EquipmentId,
  ExerciseDefinition,
  ManualPlanDraft,
} from "../../domain/planning/types";
import { ExerciseBrowser } from "../exercises/ExerciseBrowser";
import "./manual-plan-form.css";

const equipmentLabels: Record<EquipmentId, string> = {
  mat: "瑜伽垫",
  resistance_band: "弹力带",
  dumbbell: "哑铃",
  kettlebell: "壶铃",
  pull_up_bar: "单杠",
  bench: "训练凳",
};

type EditableTarget =
  | {
      kind: "reps";
      min: string;
      max: string;
      basis: ExerciseDefinition["measure"]["basis"];
    }
  | {
      kind: "durationSeconds";
      seconds: string;
      basis: ExerciseDefinition["measure"]["basis"];
    };

interface EditableExercise {
  exerciseId: string;
  sets: string;
  restSeconds: string;
  target: EditableTarget;
}

function getDefaultExercise(): ExerciseDefinition {
  const exercise = builtInExerciseCatalog.find(
    (item) => item.id === "bodyweight-squat",
  );
  if (!exercise) {
    throw new Error("动作库缺少默认动作：徒手深蹲");
  }
  return exercise;
}

const defaultExercise = getDefaultExercise();

function createEditableExercise(
  exercise: ExerciseDefinition,
): EditableExercise {
  const target: EditableTarget =
    exercise.measure.kind === "durationSeconds"
      ? {
          kind: "durationSeconds",
          seconds: "30",
          basis: exercise.measure.basis,
        }
      : {
          kind: "reps",
          min: "8",
          max: "12",
          basis: exercise.measure.basis,
        };

  return {
    exerciseId: exercise.id,
    sets: "3",
    restSeconds: String(exercise.defaultRestSeconds),
    target,
  };
}

function createInitialExercises(
  initialPlan: ManualPlanDraft | undefined,
): EditableExercise[] {
  const plannedExercises = initialPlan?.days[0]?.exercises;
  if (!plannedExercises?.length) {
    return [createEditableExercise(defaultExercise)];
  }

  const editableExercises = [...plannedExercises]
    .sort((left, right) => left.order - right.order)
    .flatMap((plannedExercise) => {
      const definition = builtInExerciseCatalog.find(
        (exercise) => exercise.id === plannedExercise.exerciseId,
      );
      if (!definition) return [];

      const target: EditableTarget =
        plannedExercise.target.kind === "reps"
          ? {
              kind: "reps",
              min: String(plannedExercise.target.min),
              max: String(plannedExercise.target.max),
              basis: plannedExercise.target.basis,
            }
          : {
              kind: "durationSeconds",
              seconds: String(plannedExercise.target.seconds),
              basis: plannedExercise.target.basis,
            };
      return [
        {
          exerciseId: definition.id,
          sets: String(plannedExercise.sets),
          restSeconds: String(plannedExercise.restSeconds),
          target,
        },
      ];
    });

  return editableExercises.length > 0
    ? editableExercises
    : [createEditableExercise(defaultExercise)];
}

function equipmentRequirement(exercise: ExerciseDefinition): string {
  if (exercise.requiredEquipment.length === 0) return "无需器械";
  return `需要：${exercise.requiredEquipment
    .map((equipment) => equipmentLabels[equipment])
    .join("、")}`;
}

function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export interface ManualPlanFormProps {
  initialPlan?: ManualPlanDraft;
  isSubmitting?: boolean;
  onPlanCreated: (plan: ManualPlanDraft) => void;
  onBrowserBackRequestChange?: (handler: (() => boolean) | null) => void;
  onBrowserBackAvailabilityChange?: (available: boolean) => void;
}

export function ManualPlanForm({
  initialPlan,
  isSubmitting = false,
  onPlanCreated,
  onBrowserBackRequestChange,
  onBrowserBackAvailabilityChange,
}: ManualPlanFormProps) {
  const titleId = useId();
  const errorId = useId();
  const [dayName, setDayName] = useState(
    () => initialPlan?.days[0]?.name ?? "居家全身训练",
  );
  const [selectedExercises, setSelectedExercises] = useState<
    EditableExercise[]
  >(() => createInitialExercises(initialPlan));
  const [error, setError] = useState<string | null>(null);

  function setExerciseSelected(exercise: ExerciseDefinition, checked: boolean) {
    setSelectedExercises((current) => {
      if (checked) {
        if (current.some((item) => item.exerciseId === exercise.id)) {
          return current;
        }
        return [...current, createEditableExercise(exercise)];
      }
      return current.filter((item) => item.exerciseId !== exercise.id);
    });
    setError(null);
  }

  function updateExercise(
    exerciseId: string,
    update: (exercise: EditableExercise) => EditableExercise,
  ) {
    setSelectedExercises((current) =>
      current.map((exercise) =>
        exercise.exerciseId === exerciseId ? update(exercise) : exercise,
      ),
    );
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const candidate = {
      source: { kind: "manual" as const },
      days: [
        {
          ordinal: 1,
          name: dayName,
          exercises: selectedExercises.map((exercise, order) => ({
            exerciseId: exercise.exerciseId,
            order,
            sets: toNumber(exercise.sets),
            target:
              exercise.target.kind === "reps"
                ? {
                    kind: "reps" as const,
                    min: toNumber(exercise.target.min),
                    max: toNumber(exercise.target.max),
                    basis: exercise.target.basis,
                  }
                : {
                    kind: "durationSeconds" as const,
                    seconds: toNumber(exercise.target.seconds),
                    basis: exercise.target.basis,
                  },
            restSeconds: toNumber(exercise.restSeconds),
          })),
        },
      ],
    };
    const parsedDraft = planDraftSchema.safeParse(candidate);

    if (!parsedDraft.success) {
      if (selectedExercises.length === 0) {
        setError("请至少选择一个动作后再保存。");
      } else if (dayName.trim() === "") {
        setError("请填写训练日名称。");
      } else {
        setError(
          "请检查动作设置：组数需为 1–20，次数、时长和休息秒数需在有效范围内。",
        );
      }
      return;
    }

    setError(null);
    onPlanCreated({
      source: { kind: "manual" },
      days: parsedDraft.data.days,
    });
  }

  return (
    <section className="manual-plan-form" aria-labelledby={titleId}>
      <header className="manual-plan-form__header">
        <p className="manual-plan-form__eyebrow">手动编排 · 单训练日</p>
        <h2 id={titleId}>手动创建计划</h2>
        <p>先选动作，再设置每组目标与组间休息。计划只保存在本机。</p>
      </header>

      <form
        className="manual-plan-form__form"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="manual-plan-form__field manual-plan-form__day-name">
          <span>训练日名称</span>
          <input
            name="dayName"
            type="text"
            maxLength={80}
            value={dayName}
            onChange={(event) => {
              setDayName(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>

        <section className="manual-plan-form__browser" aria-label="选择动作">
          <ExerciseBrowser
            exercises={builtInExerciseCatalog}
            selectedExerciseIds={selectedExercises.map(
              (exercise) => exercise.exerciseId,
            )}
            onExerciseSelect={(exercise) =>
              setExerciseSelected(exercise, true)
            }
            onBackRequestChange={onBrowserBackRequestChange}
            onBackAvailabilityChange={onBrowserBackAvailabilityChange}
          />
        </section>

        <div className="manual-plan-form__selected" aria-live="polite">
          <div className="manual-plan-form__selected-heading">
            <h3>动作设置</h3>
            <span>{selectedExercises.length} 个动作</span>
          </div>

          {selectedExercises.length === 0 ? (
            <p className="manual-plan-form__empty">从上方动作库选择动作。</p>
          ) : null}

          {selectedExercises.map((editableExercise) => {
            const definition = builtInExerciseCatalog.find(
              (exercise) => exercise.id === editableExercise.exerciseId,
            );
            if (!definition) return null;

            return (
              <fieldset
                className="manual-plan-form__exercise"
                key={editableExercise.exerciseId}
              >
                <legend>{definition.name}设置</legend>
                <div className="manual-plan-form__exercise-head">
                  <span>{equipmentRequirement(definition)}</span>
                  <button
                    type="button"
                    aria-label={`移除${definition.name}`}
                    onClick={() => setExerciseSelected(definition, false)}
                  >
                    移除
                  </button>
                </div>

                <div className="manual-plan-form__input-grid">
                  <label className="manual-plan-form__field">
                    <span>组数</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      inputMode="numeric"
                      value={editableExercise.sets}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        updateExercise(editableExercise.exerciseId, (exercise) => ({
                          ...exercise,
                          sets: value,
                        }));
                      }}
                    />
                  </label>

                  {editableExercise.target.kind === "reps" ? (
                    <>
                      <label className="manual-plan-form__field">
                        <span>最少次数</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={editableExercise.target.min}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            updateExercise(
                              editableExercise.exerciseId,
                              (exercise) =>
                                exercise.target.kind === "reps"
                                  ? {
                                      ...exercise,
                                      target: { ...exercise.target, min: value },
                                    }
                                  : exercise,
                            );
                          }}
                        />
                      </label>
                      <label className="manual-plan-form__field">
                        <span>最多次数</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={editableExercise.target.max}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            updateExercise(
                              editableExercise.exerciseId,
                              (exercise) =>
                                exercise.target.kind === "reps"
                                  ? {
                                      ...exercise,
                                      target: { ...exercise.target, max: value },
                                    }
                                  : exercise,
                            );
                          }}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="manual-plan-form__field">
                      <span>每组时长（秒）</span>
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        step="1"
                        inputMode="numeric"
                        value={editableExercise.target.seconds}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updateExercise(
                            editableExercise.exerciseId,
                            (exercise) =>
                              exercise.target.kind === "durationSeconds"
                                ? {
                                    ...exercise,
                                    target: { ...exercise.target, seconds: value },
                                  }
                                : exercise,
                          );
                        }}
                      />
                    </label>
                  )}

                  <label className="manual-plan-form__field">
                    <span>组间休息（秒）</span>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      step="15"
                      inputMode="numeric"
                      value={editableExercise.restSeconds}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        updateExercise(editableExercise.exerciseId, (exercise) => ({
                          ...exercise,
                          restSeconds: value,
                        }));
                      }}
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>

        {error ? (
          <p className="manual-plan-form__error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="manual-plan-form__submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "正在保存…" : "保存手动计划"}
        </button>
      </form>
    </section>
  );
}
