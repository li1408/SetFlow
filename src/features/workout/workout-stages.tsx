import { useState, type RefObject } from "react";
import type {
  ActualSet,
  WorkoutPlanSnapshot,
  WorkoutPosition,
  WorkoutSession,
} from "../../domain/workout/types";

type SnapshotExercise = WorkoutPlanSnapshot["exercises"][number];

interface StageHeadingProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
}

interface ActiveSetStageProps extends StageHeadingProps {
  exercise: SnapshotExercise;
  position: WorkoutPosition;
  isPending: boolean;
  onComplete: (actual: ActualSet) => void;
}

export function ActiveSetStage({
  exercise,
  position,
  isPending,
  onComplete,
  headingRef,
}: ActiveSetStageProps) {
  const target = exercise.target;
  const isReps = target.kind === "reps";
  const [actualValue, setActualValue] = useState(() =>
    String(target.kind === "reps" ? target.min : target.seconds),
  );
  const [additionalWeight, setAdditionalWeight] = useState("");
  const parsedActual = Number(actualValue);
  const parsedWeight = additionalWeight === "" ? null : Number(additionalWeight);
  const isValid =
    Number.isInteger(parsedActual) &&
    parsedActual > 0 &&
    (parsedWeight === null ||
      (Number.isFinite(parsedWeight) && parsedWeight >= 0));

  const submit = () => {
    if (!isValid) return;
    onComplete(
      target.kind === "reps"
        ? {
            kind: "reps",
            reps: parsedActual,
            additionalWeightKg: parsedWeight,
          }
        : { kind: "durationSeconds", seconds: parsedActual },
    );
  };

  return (
    <form
      className="workout-stage-layout"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <header className="workout-header">
        <p className="workout-kicker">
          第 {position.setIndex + 1} / {exercise.sets} 组
        </p>
        <h1 ref={headingRef} id="workout-stage-title" tabIndex={-1}>
          {exercise.name}
        </h1>
        <p className="workout-cue">{exercise.cue}</p>
      </header>

      <div className="workout-target" aria-label={`本组${formatTarget(exercise)}`}>
        <span>本组目标</span>
        <strong>{formatTarget(exercise)}</strong>
      </div>

      <div className="workout-fields">
        <label className="workout-field">
          <span>{isReps ? "实际次数" : "实际时长（秒）"}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={actualValue}
            onChange={(event) => setActualValue(event.target.value)}
          />
        </label>

        {isReps ? (
          <label className="workout-field">
            <span>附加重量（千克）</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              placeholder="无"
              value={additionalWeight}
              onChange={(event) => setAdditionalWeight(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      <button
        className="workout-primary-action"
        type="submit"
        disabled={!isValid || isPending}
      >
        {isPending ? "正在保存…" : "完成本组"}
      </button>
    </form>
  );
}

interface RestingStageProps extends StageHeadingProps {
  remainingMilliseconds: number;
  nextExercise: SnapshotExercise;
  nextPosition: WorkoutPosition;
  isPending: boolean;
  onAdjustDown: () => void;
  onAdjustUp: () => void;
  onSkip: () => void;
}

export function RestingStage({
  remainingMilliseconds,
  nextExercise,
  nextPosition,
  isPending,
  onAdjustDown,
  onAdjustUp,
  onSkip,
  headingRef,
}: RestingStageProps) {
  return (
    <div className="workout-stage-layout workout-rest-stage">
      <header className="workout-header">
        <p className="workout-kicker">保持呼吸 · 放松准备</p>
        <h1 ref={headingRef} id="workout-stage-title" tabIndex={-1}>
          组间休息
        </h1>
      </header>

      <div
        className="workout-timer"
        role="timer"
        aria-label={`剩余休息时间 ${formatClock(remainingMilliseconds)}`}
      >
        {formatClock(remainingMilliseconds)}
      </div>

      <div className="workout-rest-controls" aria-label="调整休息时间">
        <button
          type="button"
          aria-label="减少休息 15 秒"
          disabled={isPending}
          onClick={onAdjustDown}
        >
          −15 秒
        </button>
        <button
          type="button"
          aria-label="增加休息 15 秒"
          disabled={isPending}
          onClick={onAdjustUp}
        >
          +15 秒
        </button>
      </div>

      <section className="workout-next-preview" aria-labelledby="next-preview-title">
        <p id="next-preview-title">下一组</p>
        <strong>{nextExercise.name}</strong>
        <span>
          第 {nextPosition.setIndex + 1} / {nextExercise.sets} 组 ·{" "}
          {formatTarget(nextExercise)}
        </span>
      </section>

      <button
        className="workout-secondary-action"
        type="button"
        disabled={isPending}
        onClick={onSkip}
      >
        跳过休息
      </button>
    </div>
  );
}

interface NextSetReadyStageProps extends StageHeadingProps {
  exercise: SnapshotExercise;
  position: WorkoutPosition;
  isPending: boolean;
  onActivate: () => void;
}

export function NextSetReadyStage({
  exercise,
  position,
  isPending,
  onActivate,
  headingRef,
}: NextSetReadyStageProps) {
  return (
    <div className="workout-stage-layout workout-ready-stage">
      <header className="workout-header">
        <p className="workout-kicker">休息结束</p>
        <h1 ref={headingRef} id="workout-stage-title" tabIndex={-1}>
          下一组已准备
        </h1>
      </header>

      <div className="workout-ready-card">
        <span>
          第 {position.setIndex + 1} / {exercise.sets} 组
        </span>
        <strong>{exercise.name}</strong>
        <p>{formatTarget(exercise)}</p>
      </div>

      <button
        className="workout-primary-action"
        type="button"
        disabled={isPending}
        onClick={onActivate}
      >
        {isPending ? "正在开始…" : "开始下一组"}
      </button>
    </div>
  );
}

interface CompletedStageProps extends StageHeadingProps {
  session: WorkoutSession;
}

export function CompletedStage({ session, headingRef }: CompletedStageProps) {
  const completedAt =
    session.phase.kind === "completed"
      ? session.phase.completedAt
      : (session.startedAt ?? 0);
  const elapsed = Math.max(0, completedAt - (session.startedAt ?? completedAt));
  const exerciseCount = new Set(
    session.performedSets.map((performedSet) => performedSet.exerciseId),
  ).size;

  return (
    <div className="workout-stage-layout workout-complete-stage">
      <header className="workout-header">
        <p className="workout-kicker">{session.snapshot.planName}</p>
        <h1 ref={headingRef} id="workout-stage-title" tabIndex={-1}>
          训练完成
        </h1>
        <p className="workout-cue">今天的每一组都已保存到本机。</p>
      </header>

      <dl className="workout-summary">
        <div>
          <dt>完成组数</dt>
          <dd>{session.performedSets.length} 组</dd>
        </div>
        <div>
          <dt>完成动作</dt>
          <dd>{exerciseCount} 个动作</dd>
        </div>
        <div>
          <dt>训练时长</dt>
          <dd>{formatClock(elapsed)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function InvalidStage({
  headingRef,
  isIdle = false,
}: StageHeadingProps & { isIdle?: boolean }) {
  return (
    <div className="workout-stage-layout workout-invalid-stage" role="status">
      <header className="workout-header">
        <p className="workout-kicker">训练状态</p>
        <h1 ref={headingRef} id="workout-stage-title" tabIndex={-1}>
          {isIdle ? "训练尚未开始" : "训练数据需要检查"}
        </h1>
        <p className="workout-cue">
          {isIdle ? "请从今日计划开始训练。" : "当前动作无法读取，请返回今日计划。"}
        </p>
      </header>
    </div>
  );
}

function formatTarget(exercise: SnapshotExercise): string {
  const suffix = exercise.target.basis === "per_side" ? " / 每侧" : "";
  if (exercise.target.kind === "reps") {
    return `${exercise.target.min}–${exercise.target.max} 次${suffix}`;
  }
  return `${exercise.target.seconds} 秒${suffix}`;
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
