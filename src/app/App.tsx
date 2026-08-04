import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Dumbbell,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import type { StoredPlan } from "../data/types";
import { builtInExerciseCatalog } from "../domain/exercises/built-in-catalog";
import type {
  GeneratedPlanDraft,
  PlanDraft,
  PlannedTarget,
} from "../domain/planning/types";
import { createWorkoutSession } from "../domain/workout/workout-machine";
import type {
  WorkoutEvent,
  WorkoutPlanSnapshot,
  WorkoutSession,
  WorkoutTransition,
} from "../domain/workout/types";
import { PlanGenerationForm } from "../features/plans/plan-generation-form";
import { ManualPlanForm } from "../features/plans/manual-plan-form";
import { WorkoutExecutionScreen } from "../features/workout/WorkoutExecutionScreen";
import {
  defaultAppServices,
  type AppServices,
} from "./services";
import "./app.css";

gsap.registerPlugin(useGSAP);

type AppScreen = "home" | "plan-builder" | "today" | "workout";

export interface AppProps {
  services?: AppServices;
}

const exercisesById = new Map(
  builtInExerciseCatalog.map((exercise) => [exercise.id, exercise]),
);

export function App({ services = defaultAppServices }: AppProps) {
  const appRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    void Promise.all([
      services.plans.getActive(),
      services.workouts.recoverActive(services.now()),
    ])
      .then(([plan, activeWorkout]) => {
        if (ignore) return;
        setActivePlan(plan);
        if (activeWorkout) {
          setWorkout(activeWorkout);
          setScreen("workout");
        } else if (plan) {
          setScreen("today");
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("本地训练数据暂时无法读取，请重新打开应用。");
        }
      });

    return () => {
      ignore = true;
    };
  }, [services]);

  useGSAP(
    () => {
      if (screen === "workout") return;

      const media = gsap.matchMedia();
      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          compact: "(max-height: 700px)",
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(".js-screen-reveal", { clearProps: "all" });
            return;
          }

          const distance = context.conditions?.compact ? 10 : 16;
          gsap
            .timeline({ defaults: { duration: 0.42, ease: "power2.out" } })
            .from(".js-brand", { autoAlpha: 0, y: -distance })
            .from(
              ".js-screen-reveal",
              {
                autoAlpha: 0,
                y: distance,
                stagger: 0.07,
                clearProps: "transform,opacity,visibility",
              },
              "<0.1",
            );
        },
      );

      return () => media.revert();
    },
    { scope: appRef, dependencies: [screen], revertOnUpdate: true },
  );

  async function savePlan(draftOverride?: PlanDraft) {
    const draftToSave = draftOverride ?? planDraft;
    if (!draftToSave || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const plan = await services.plans.saveActive({
        id: activePlan?.id ?? services.createId(),
        name: activePlan?.name ?? "我的居家计划",
        draft: draftToSave,
      });
      setActivePlan(plan);
      setPlanDraft(null);
      setScreen("today");
    } catch {
      setError("计划未能保存，请重试。你的输入仍保留在本页。");
    } finally {
      setIsBusy(false);
    }
  }

  async function startWorkout() {
    if (!activePlan || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const snapshot = snapshotFromPlan(activePlan);
      const session = createWorkoutSession(services.createId(), snapshot);
      await services.workouts.create(session);
      const transition = await services.workouts.apply(session.id, {
        type: "start",
        at: services.now(),
      });
      if (transition.kind !== "changed") {
        throw new Error("Workout did not start");
      }
      setWorkout(transition.state);
      setScreen("workout");
    } catch {
      setError("训练未能开始，请确认当前没有另一场进行中的训练。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleWorkoutEvent(
    event: WorkoutEvent,
  ): Promise<WorkoutTransition> {
    if (!workout) throw new Error("No active workout");
    const transition = await services.workouts.apply(workout.id, event);
    setWorkout(transition.state);
    return transition;
  }

  const showingWorkout = screen === "workout" && workout !== null;

  return (
    <div className={showingWorkout ? "app-workout-host" : "app"} ref={appRef}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      {showingWorkout ? (
        <main id="main-content">
          <WorkoutExecutionScreen
            session={workout}
            onEvent={handleWorkoutEvent}
            onFinish={() => {
              setWorkout(null);
              setScreen(activePlan ? "today" : "home");
            }}
          />
        </main>
      ) : (
        <>
          <AppHeader />
          <main
            className={`main ${screen === "home" ? "" : "main--flow"}`}
            id="main-content"
          >
            {error ? (
              <p className="app-error js-screen-reveal" role="alert">
                {error}
              </p>
            ) : null}

            {screen === "home" ? (
              <LandingScreen onCreate={() => setScreen("plan-builder")} />
            ) : null}

            {screen === "plan-builder" ? (
              <PlanBuilderScreen
                draft={planDraft}
                initialMode={activePlan?.draft.source.kind ?? "generated"}
                isBusy={isBusy}
                onBack={() => setScreen(activePlan ? "today" : "home")}
                onGenerated={setPlanDraft}
                onManualCreated={(draft) => void savePlan(draft)}
                onSave={() => void savePlan()}
              />
            ) : null}

            {screen === "today" && activePlan ? (
              <TodayScreen
                plan={activePlan}
                isBusy={isBusy}
                onEdit={() => {
                  setPlanDraft(null);
                  setScreen("plan-builder");
                }}
                onStart={() => void startWorkout()}
              />
            ) : null}
          </main>

          <footer className="build-note js-screen-reveal">
            <span>SETFLOW / MVP 01</span>
            <span>为小米 15 优先验证</span>
          </footer>
        </>
      )}
    </div>
  );
}

function AppHeader() {
  return (
    <header className="topbar js-brand">
      <div className="brand-mark" aria-hidden="true">
        <Dumbbell size={18} strokeWidth={2.4} />
      </div>
      <div>
        <p className="brand-name">SETFLOW</p>
        <p className="brand-caption">本地训练助手</p>
      </div>
      <div className="local-badge">
        <LockKeyhole size={13} aria-hidden="true" />
        <span>仅本机</span>
      </div>
    </header>
  );
}

function LandingScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <>
      <section className="hero js-screen-reveal" aria-labelledby="today-title">
        <p className="eyebrow">
          <Sparkles size={14} aria-hidden="true" />
          你的下一次训练，从这里开始
        </p>
        <h1 className="hero-title" id="today-title">
          今天，开始动起来
        </h1>
        <p className="hero-copy">
          创建一个适合你时间、经验和器械条件的计划。完成每组后，SetFlow 会接管休息节奏。
        </p>
      </section>

      <section className="readiness js-screen-reveal" aria-label="计划状态">
        <div className="orbit" aria-hidden="true">
          <div className="orbit-inner">
            <span className="orbit-value">0</span>
            <span className="orbit-label">待训练</span>
          </div>
        </div>
        <div className="readiness-copy">
          <p className="status-label">当前状态</p>
          <h2>还没有训练计划</h2>
          <p>可以用离线规则自动生成，也可以逐个动作手动安排。</p>
        </div>
      </section>

      <div className="js-screen-reveal">
        <button className="primary-action" type="button" onClick={onCreate}>
          <span>创建我的计划</span>
          <ArrowUpRight size={21} aria-hidden="true" />
        </button>
        <p className="privacy-note">
          无需账号 · 无需联网 · 训练记录只保存在这台设备
        </p>
      </div>
    </>
  );
}

function PlanBuilderScreen({
  draft,
  initialMode,
  isBusy,
  onBack,
  onGenerated,
  onManualCreated,
  onSave,
}: {
  draft: PlanDraft | null;
  initialMode: PlanDraft["source"]["kind"];
  isBusy: boolean;
  onBack: () => void;
  onGenerated: (draft: GeneratedPlanDraft) => void;
  onManualCreated: (draft: Extract<PlanDraft, { source: { kind: "manual" } }>) => void;
  onSave: () => void;
}) {
  const [mode, setMode] = useState<PlanDraft["source"]["kind"]>(initialMode);

  return (
    <div className="flow-screen">
      <button className="text-action js-screen-reveal" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回
      </button>

      <div className="plan-mode-switch js-screen-reveal" role="tablist" aria-label="计划创建方式">
        <button
          aria-controls="generated-plan-panel"
          aria-selected={mode === "generated"}
          id="generated-plan-tab"
          role="tab"
          type="button"
          onClick={() => setMode("generated")}
        >
          规则生成
        </button>
        <button
          aria-controls="manual-plan-panel"
          aria-selected={mode === "manual"}
          id="manual-plan-tab"
          role="tab"
          type="button"
          onClick={() => setMode("manual")}
        >
          手动创建
        </button>
      </div>

      {mode === "generated" ? (
        <div
          aria-labelledby="generated-plan-tab"
          className="js-screen-reveal"
          id="generated-plan-panel"
          role="tabpanel"
        >
          <PlanGenerationForm onPlanGenerated={onGenerated} />
        </div>
      ) : (
        <div
          aria-labelledby="manual-plan-tab"
          className="js-screen-reveal"
          id="manual-plan-panel"
          role="tabpanel"
        >
          <ManualPlanForm
            isSubmitting={isBusy}
            onPlanCreated={onManualCreated}
          />
        </div>
      )}

      {mode === "generated" && draft?.source.kind === "generated" ? (
        <div className="sticky-action js-screen-reveal">
          <button
            className="primary-action"
            type="button"
            disabled={isBusy}
            onClick={onSave}
          >
            <span>{isBusy ? "正在保存…" : "保存并使用这个计划"}</span>
            <ArrowUpRight size={21} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TodayScreen({
  plan,
  isBusy,
  onEdit,
  onStart,
}: {
  plan: StoredPlan;
  isBusy: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  const day = plan.draft.days[0]!;
  const estimatedMinutes = estimateMinutes(day.exercises);

  return (
    <div className="today-screen">
      <section className="today-heading js-screen-reveal" aria-labelledby="today-plan-title">
        <p className="eyebrow">
          <CalendarDays size={14} aria-hidden="true" />
          今日训练
        </p>
        <h1 id="today-plan-title">{day.name}</h1>
        <div className="today-meta">
          <span>{day.exercises.length} 个动作</span>
          <span>
            <Clock3 size={14} aria-hidden="true" />约 {estimatedMinutes} 分钟
          </span>
        </div>
      </section>

      <ol className="today-exercises js-screen-reveal">
        {day.exercises.map((plannedExercise, index) => {
          const exercise = exercisesById.get(plannedExercise.exerciseId);
          return (
            <li key={plannedExercise.exerciseId}>
              <span className="exercise-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{exercise?.name ?? "动作待确认"}</strong>
                <p>
                  {plannedExercise.sets} 组 · {formatTarget(plannedExercise.target)} ·
                  休息 {plannedExercise.restSeconds} 秒
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="today-actions js-screen-reveal">
        <button
          className="primary-action"
          type="button"
          disabled={isBusy}
          onClick={onStart}
        >
          <span>{isBusy ? "正在开始…" : "开始今天训练"}</span>
          <ArrowUpRight size={21} aria-hidden="true" />
        </button>
        <button className="text-action text-action--center" type="button" onClick={onEdit}>
          调整训练计划
        </button>
      </div>
    </div>
  );
}

function snapshotFromPlan(plan: StoredPlan): WorkoutPlanSnapshot {
  const day = plan.draft.days[0];
  if (!day) throw new Error("Plan has no workout day");

  const exercises = day.exercises.map((plannedExercise) => {
    const definition = exercisesById.get(plannedExercise.exerciseId);
    if (!definition) throw new Error("Plan references an unknown exercise");
    return {
      id: definition.id,
      name: definition.name,
      cue: definition.cue,
      sets: plannedExercise.sets,
      target: plannedExercise.target,
      restSeconds: plannedExercise.restSeconds,
    };
  });

  return {
    planId: plan.id,
    planName: day.name,
    exercises,
  };
}

function estimateMinutes(
  exercises: PlanDraft["days"][number]["exercises"],
): number {
  const seconds = exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets * 45 +
      Math.max(0, exercise.sets - 1) * exercise.restSeconds,
    0,
  );
  return Math.max(1, Math.round(seconds / 60));
}

function formatTarget(target: PlannedTarget): string {
  const side = target.basis === "per_side" ? "每侧 " : "";
  return target.kind === "reps"
    ? `${side}${target.min}–${target.max} 次`
    : `${side}${target.seconds} 秒`;
}
