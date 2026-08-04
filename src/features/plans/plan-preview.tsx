import { useId } from "react";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import type {
  GeneratedPlanDraft,
  PlannedTarget,
} from "../../domain/planning/types";

const exerciseNamesById = new Map(
  builtInExerciseCatalog.map((exercise) => [exercise.id, exercise.name]),
);

export interface PlanPreviewProps {
  plan: GeneratedPlanDraft;
}

export function PlanPreview({ plan }: PlanPreviewProps) {
  const titleId = useId();

  return (
    <section
      className="plan-preview"
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <div className="plan-preview__header">
        <h3 id={titleId}>计划预览</h3>
        <p>规则版本 {plan.source.ruleVersion}</p>
      </div>

      <ol className="plan-preview__days">
        {plan.days.map((day) => (
          <li className="plan-preview__day" key={day.ordinal}>
            <h4>{day.name}</h4>
            <ol className="plan-preview__exercises">
              {day.exercises.map((exercise) => (
                <li key={`${day.ordinal}-${exercise.exerciseId}`}>
                  <strong>
                    {exerciseNamesById.get(exercise.exerciseId) ?? "动作待确认"}
                  </strong>
                  <span>
                    {exercise.sets} 组 · {formatTarget(exercise.target)} · 休息{" "}
                    {exercise.restSeconds} 秒
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatTarget(target: PlannedTarget): string {
  const sideLabel = target.basis === "per_side" ? "每侧 " : "";

  if (target.kind === "durationSeconds") {
    return `${sideLabel}${target.seconds} 秒`;
  }

  return `${sideLabel}${target.min}–${target.max} 次`;
}
