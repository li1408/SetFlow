import { useId, useState } from "react";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { planDraftSchema } from "../../domain/planning/schemas";
import type {
  ExerciseDefinition,
  GeneratedPlanDraft,
  PlannedExerciseDraft,
  PlannedTarget,
} from "../../domain/planning/types";
import "./plan-preview.css";

const exercisesById = new Map(
  builtInExerciseCatalog.map((exercise) => [exercise.id, exercise]),
);

export interface PlanPreviewProps {
  plan: GeneratedPlanDraft;
  onPlanChange?: (plan: GeneratedPlanDraft) => void;
}

export function PlanPreview({ plan, onPlanChange }: PlanPreviewProps) {
  const titleId = useId();
  const normalizedPlan = normalizePlan(plan);

  function commit(candidate: GeneratedPlanDraft) {
    const parsed = planDraftSchema.safeParse(normalizePlan(candidate));
    if (parsed.success && parsed.data.source.kind === "generated") {
      onPlanChange?.(parsed.data as GeneratedPlanDraft);
    }
  }

  function updateExercises(
    dayIndex: number,
    update: (exercises: PlannedExerciseDraft[]) => PlannedExerciseDraft[],
  ) {
    const day = normalizedPlan.days[dayIndex];
    if (!day) return;

    commit({
      ...normalizedPlan,
      days: normalizedPlan.days.map((item, index) =>
        index === dayIndex
          ? { ...item, exercises: update(item.exercises) }
          : item,
      ),
    });
  }

  return (
    <section
      className={`plan-preview${onPlanChange ? " plan-preview--editable" : ""}`}
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <div className="plan-preview__header">
        <h3 id={titleId}>计划预览</h3>
        <p>规则版本 {normalizedPlan.source.ruleVersion}</p>
      </div>

      <ol className="plan-preview__days">
        {normalizedPlan.days.map((day, dayIndex) => (
          <li className="plan-preview__day" key={day.ordinal}>
            <h4>{day.name}</h4>
            <ol className="plan-preview__exercises">
              {day.exercises.map((exercise, exerciseIndex) => {
                const definition = exercisesById.get(exercise.exerciseId);
                const name = definition?.name ?? "动作待确认";

                return (
                  <li key={`${day.ordinal}-${exercise.exerciseId}`}>
                    {onPlanChange ? (
                      <ExerciseEditor
                        definition={definition}
                        exercise={exercise}
                        exerciseIndex={exerciseIndex}
                        exercises={day.exercises}
                        name={name}
                        onMove={(direction) =>
                          updateExercises(dayIndex, (exercises) =>
                            moveExercise(exercises, exerciseIndex, direction),
                          )
                        }
                        onReplace={(replacement) =>
                          updateExercises(dayIndex, (exercises) =>
                            exercises.map((item, index) =>
                              index === exerciseIndex
                                ? replaceExercise(item, replacement)
                                : item,
                            ),
                          )
                        }
                        onUpdate={(update) =>
                          updateExercises(dayIndex, (exercises) =>
                            exercises.map((item, index) =>
                              index === exerciseIndex ? update(item) : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      <>
                        <strong>{name}</strong>
                        <span>
                          {exercise.sets} 组 · {formatTarget(exercise.target)} ·
                          休息 {exercise.restSeconds} 秒
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface ExerciseEditorProps {
  definition: ExerciseDefinition | undefined;
  exercise: PlannedExerciseDraft;
  exerciseIndex: number;
  exercises: PlannedExerciseDraft[];
  name: string;
  onMove: (direction: -1 | 1) => void;
  onReplace: (definition: ExerciseDefinition) => void;
  onUpdate: (
    update: (exercise: PlannedExerciseDraft) => PlannedExerciseDraft,
  ) => void;
}

function ExerciseEditor({
  definition,
  exercise,
  exerciseIndex,
  exercises,
  name,
  onMove,
  onReplace,
  onUpdate,
}: ExerciseEditorProps) {
  const unavailableIds = new Set(
    exercises
      .filter((_, index) => index !== exerciseIndex)
      .map((item) => item.exerciseId),
  );

  return (
    <fieldset className="plan-preview__editor">
      <legend>{name}设置</legend>
      <div className="plan-preview__editor-head">
        <span>动作 {exerciseIndex + 1}</span>
        <div className="plan-preview__order-actions">
          <button
            type="button"
            aria-label={`上移${name}`}
            disabled={exerciseIndex === 0}
            onClick={() => onMove(-1)}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            aria-label={`下移${name}`}
            disabled={exerciseIndex === exercises.length - 1}
            onClick={() => onMove(1)}
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      <label className="plan-preview__field plan-preview__field--wide">
        <span>替换动作</span>
        <select
          value={exercise.exerciseId}
          onChange={(event) => {
            const replacement = exercisesById.get(event.currentTarget.value);
            if (replacement && !unavailableIds.has(replacement.id)) {
              onReplace(replacement);
            }
          }}
        >
          {!definition ? (
            <option value={exercise.exerciseId}>动作待确认</option>
          ) : null}
          {builtInExerciseCatalog
            .filter((item) => !unavailableIds.has(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>

      <div className="plan-preview__input-grid">
        <NumberField
          label="组数"
          min={1}
          max={20}
          value={exercise.sets}
          onValueChange={(sets) =>
            onUpdate(() => ({ ...exercise, sets }))
          }
        />
        {exercise.target.kind === "reps" ? (
          <>
            <NumberField
              label="最少次数"
              min={0}
              value={exercise.target.min}
              onValueChange={(min) =>
                onUpdate(() => ({
                  ...exercise,
                  target: { ...exercise.target, min },
                }))
              }
            />
            <NumberField
              label="最多次数"
              min={1}
              value={exercise.target.max}
              onValueChange={(max) =>
                onUpdate(() => ({
                  ...exercise,
                  target: { ...exercise.target, max },
                }))
              }
            />
          </>
        ) : (
          <NumberField
            label="每组时长（秒）"
            min={1}
            max={3_600}
            value={exercise.target.seconds}
            onValueChange={(seconds) =>
              onUpdate(() => ({
                ...exercise,
                target: { ...exercise.target, seconds },
              }))
            }
          />
        )}
        <NumberField
          label="组间休息（秒）"
          min={0}
          max={600}
          value={exercise.restSeconds}
          onValueChange={(restSeconds) =>
            onUpdate(() => ({
              ...exercise,
              restSeconds,
            }))
          }
        />
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  onValueChange,
}: {
  label: string;
  min: number;
  max?: number;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{
    valueAtStart: number;
    text: string;
  } | null>(null);
  const displayedValue =
    draft?.valueAtStart === value ? draft.text : String(value);

  return (
    <label className="plan-preview__field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min={min}
        max={max}
        value={displayedValue}
        onChange={(event) => {
          setDraft({ valueAtStart: value, text: event.currentTarget.value });
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isInteger(nextValue)) onValueChange(nextValue);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

function normalizePlan(plan: GeneratedPlanDraft): GeneratedPlanDraft {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: [...day.exercises]
        .sort((left, right) => left.order - right.order)
        .map((exercise, order) => ({ ...exercise, order })),
    })),
  };
}

function moveExercise(
  exercises: PlannedExerciseDraft[],
  exerciseIndex: number,
  direction: -1 | 1,
): PlannedExerciseDraft[] {
  const destination = exerciseIndex + direction;
  const current = exercises[exerciseIndex];
  const adjacent = exercises[destination];
  if (!current || !adjacent) return exercises;

  const next = [...exercises];
  next[exerciseIndex] = adjacent;
  next[destination] = current;
  return next.map((exercise, order) => ({ ...exercise, order }));
}

function replaceExercise(
  exercise: PlannedExerciseDraft,
  replacement: ExerciseDefinition,
): PlannedExerciseDraft {
  return {
    ...exercise,
    exerciseId: replacement.id,
    target: defaultTargetFor(replacement),
    restSeconds: replacement.defaultRestSeconds,
  };
}

function defaultTargetFor(exercise: ExerciseDefinition): PlannedTarget {
  return exercise.measure.kind === "durationSeconds"
    ? {
        kind: "durationSeconds",
        seconds: 30,
        basis: exercise.measure.basis,
      }
    : { kind: "reps", min: 8, max: 12, basis: exercise.measure.basis };
}

function formatTarget(target: PlannedTarget): string {
  const sideLabel = target.basis === "per_side" ? "每侧 " : "";

  if (target.kind === "durationSeconds") {
    return `${sideLabel}${target.seconds} 秒`;
  }

  return `${sideLabel}${target.min}–${target.max} 次`;
}
