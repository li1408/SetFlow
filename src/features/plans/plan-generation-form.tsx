import { useId, useState, type FormEvent } from "react";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { generatePlan } from "../../domain/planning/generate-plan";
import { planGenerationInputSchema } from "../../domain/planning/schemas";
import type {
  EquipmentId,
  ExperienceLevel,
  GeneratedPlanDraft,
  TrainingGoal,
} from "../../domain/planning/types";
import { PlanPreview } from "./plan-preview";
import "./plan-generation-form.css";

const goalOptions: Array<{ value: TrainingGoal; label: string }> = [
  { value: "general_fitness", label: "综合体能" },
  { value: "strength", label: "力量" },
  { value: "hypertrophy", label: "增肌" },
  { value: "endurance", label: "肌耐力" },
];

const experienceOptions: Array<{
  value: ExperienceLevel;
  label: string;
}> = [
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "基础" },
  { value: "advanced", label: "进阶" },
];

const equipmentOptions: Array<{ value: EquipmentId; label: string }> = [
  { value: "mat", label: "瑜伽垫" },
  { value: "resistance_band", label: "弹力带" },
  { value: "dumbbell", label: "哑铃" },
  { value: "kettlebell", label: "壶铃" },
  { value: "pull_up_bar", label: "单杠" },
  { value: "bench", label: "训练凳" },
];

export interface PlanGenerationFormProps {
  initialPlan?: GeneratedPlanDraft | null;
  onPlanGenerated: (plan: GeneratedPlanDraft) => void;
}

export function PlanGenerationForm({
  initialPlan,
  onPlanGenerated,
}: PlanGenerationFormProps) {
  const titleId = useId();
  const equipmentHelpId = useId();
  const initialInput = initialPlan?.source.input;
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedPlanDraft | null>(
    () => initialPlan ?? null,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsedInput = planGenerationInputSchema.safeParse({
      goal: formData.get("goal"),
      daysPerWeek: Number(formData.get("daysPerWeek")),
      experience: formData.get("experience"),
      availableEquipment: formData
        .getAll("availableEquipment")
        .map(String),
      sessionMinutes: Number(formData.get("sessionMinutes")),
    });

    if (!parsedInput.success) {
      setPreview(null);
      setError(
        "请检查输入：每周训练天数需为 2–6 天，单次时长需为 15–90 分钟。",
      );
      return;
    }

    const result = generatePlan(parsedInput.data, builtInExerciseCatalog);
    if (!result.ok) {
      setPreview(null);
      setError("当前条件下没有可用动作，请增加器械或调整训练目标。");
      return;
    }

    setError(null);
    setPreview(result.plan);
    onPlanGenerated(result.plan);
  }

  return (
    <section
      className="plan-generation-form"
      aria-labelledby={titleId}
    >
      <header className="plan-generation-form__header">
        <p className="plan-generation-form__eyebrow">本地规则生成</p>
        <h2 id={titleId}>离线规则生成计划</h2>
        <p>不上传训练信息；不选择器械时，默认生成居家徒手计划。</p>
      </header>

      <form
        className="plan-generation-form__form"
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="plan-generation-form__field">
          <span>训练目标</span>
          <select
            name="goal"
            defaultValue={initialInput?.goal ?? "general_fitness"}
          >
            {goalOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="plan-generation-form__field">
          <span>每周训练天数</span>
          <input
            name="daysPerWeek"
            type="number"
            min="2"
            max="6"
            step="1"
            defaultValue={initialInput?.daysPerWeek ?? 3}
            inputMode="numeric"
          />
        </label>

        <label className="plan-generation-form__field">
          <span>经验水平</span>
          <select
            name="experience"
            defaultValue={initialInput?.experience ?? "beginner"}
          >
            {experienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset
          className="plan-generation-form__equipment"
          aria-describedby={equipmentHelpId}
        >
          <legend>可用器械（可多选）</legend>
          <p id={equipmentHelpId}>全部不选即为无器械</p>
          <div className="plan-generation-form__equipment-grid">
            {equipmentOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="checkbox"
                  name="availableEquipment"
                  value={option.value}
                  defaultChecked={initialInput?.availableEquipment.includes(
                    option.value,
                  )}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="plan-generation-form__field">
          <span>单次训练时长（分钟）</span>
          <input
            name="sessionMinutes"
            type="number"
            min="15"
            max="90"
            step="5"
            defaultValue={initialInput?.sessionMinutes ?? 30}
            inputMode="numeric"
          />
        </label>

        {error ? (
          <p className="plan-generation-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="plan-generation-form__submit" type="submit">
          生成离线计划
        </button>
      </form>

      {preview ? (
        <PlanPreview
          plan={preview}
          onPlanChange={(plan) => {
            setPreview(plan);
            onPlanGenerated(plan);
          }}
        />
      ) : null}
    </section>
  );
}
