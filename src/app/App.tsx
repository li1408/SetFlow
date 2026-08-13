import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  BellRing,
  Clock3,
  Dumbbell,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import type { StoredPlan } from "../data/types";
import { builtInExerciseCatalog } from "../domain/exercises/built-in-catalog";
import type {
  GeneratedPlanDraft,
  ManualPlanDraft,
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
import type { ReminderPermissionState } from "../native/reminder-adapter";
import {
  defaultInteractionFeedback,
  type InteractionFeedbackPlayer,
} from "../native/interaction-feedback";
import {
  NESTED_PREDICTIVE_BACK_EVENT,
  PREDICTIVE_BACK_EVENT,
  isPredictiveBackEvent,
} from "../native/predictive-back";
import {
  defaultAppServices,
  type AppServices,
} from "./services";
import "./app.css";

gsap.registerPlugin(useGSAP);

type AppScreen = "home" | "plan-builder" | "today" | "workout";
type ReminderUiState = ReminderPermissionState | "checking" | "error";
type ReminderDeliveryState = "idle" | "syncing" | "ready" | "degraded";
type WorkoutExitDialog = "exit" | "save" | null;

interface ReminderReadiness {
  notification: ReminderUiState;
  exactAlarm: ReminderUiState;
}

export interface AppProps {
  services?: AppServices;
  interactionFeedback?: InteractionFeedbackPlayer;
}

const exercisesById = new Map(
  builtInExerciseCatalog.map((exercise) => [exercise.id, exercise]),
);

export function App({
  services = defaultAppServices,
  interactionFeedback = defaultInteractionFeedback,
}: AppProps) {
  const appRef = useRef<HTMLDivElement>(null);
  const nestedBackHandlerRef = useRef<(() => boolean) | null>(null);
  const nestedBackAvailableRef = useRef(false);
  const requestBackRef = useRef<() => void>(() => undefined);
  const edgeGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isReminderBusy, setIsReminderBusy] = useState(false);
  const [reminderReadiness, setReminderReadiness] =
    useState<ReminderReadiness>({
      notification: "checking",
      exactAlarm: "checking",
    });
  const [reminderDelivery, setReminderDelivery] =
    useState<ReminderDeliveryState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [workoutExitDialog, setWorkoutExitDialog] =
    useState<WorkoutExitDialog>(null);
  const [backGestureProgress, setBackGestureProgress] = useState(0);

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
          if (plan) {
            const recoveredDayIndex = plan.draft.days.findIndex(
              (day) => day.name === activeWorkout.snapshot.planName,
            );
            setSelectedDayIndex(Math.max(0, recoveredDayIndex));
          }
          setWorkout(activeWorkout);
          setScreen("workout");
        } else if (plan) {
          setScreen("today");
        }
        setHasHydrated(true);
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

  useEffect(() => {
    if (!hasHydrated) return;
    let ignore = false;

    async function refreshReminders() {
      try {
        const [notification, exactAlarm] = await Promise.all([
          services.reminders.checkPermission(),
          services.reminders.checkExactAlarmSetting(),
        ]);
        if (ignore) return;
        setReminderReadiness({ notification, exactAlarm });
        if (notification !== "granted" || exactAlarm !== "granted") {
          setReminderDelivery("idle");
          return;
        }

        setReminderDelivery("syncing");
        const result = await services.reminders.flush();
        if (!ignore) {
          setReminderDelivery(
            hasReminderSyncIssues(result) ? "degraded" : "ready",
          );
        }
      } catch {
        if (!ignore) {
          setReminderReadiness({ notification: "error", exactAlarm: "error" });
          setReminderDelivery("degraded");
        }
      }
    }

    void refreshReminders();
    let removeForegroundListener: (() => void | Promise<void>) | undefined;
    void services.lifecycle
      .onForeground(() => void refreshReminders())
      .then((remove) => {
        if (ignore) {
          void remove();
        } else {
          removeForegroundListener = remove;
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
      void removeForegroundListener?.();
    };
  }, [hasHydrated, services]);

  useEffect(() => {
    let ignore = false;
    let removeBackListener: (() => void | Promise<void>) | undefined;

    void services.navigation
      .onBackButton(() => requestBackRef.current())
      .then((remove) => {
        if (ignore) {
          void remove();
        } else {
          removeBackListener = remove;
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
      void removeBackListener?.();
    };
  }, [services]);

  useGSAP(
    () => {
      if (screen === "workout") return;

      const media = gsap.matchMedia();
      const compactViewport = window.innerHeight <= 700;
      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          allowMotion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(".js-screen-reveal", { clearProps: "all" });
            return;
          }

          if (!context.conditions?.allowMotion) return;

          const distance = compactViewport ? 10 : 16;
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
      setSelectedDayIndex(0);
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
      const snapshot = snapshotFromPlan(activePlan, selectedDayIndex);
      const session = createWorkoutSession(services.createId(), snapshot);
      const transition = await services.workouts.start(session, services.now());
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

  async function enableReminders() {
    if (isReminderBusy) return;
    setIsReminderBusy(true);
    try {
      const notification =
        reminderReadiness.notification === "granted"
          ? "granted"
          : await services.reminders.requestPermission();
      const exactAlarm =
        notification === "granted" &&
        reminderReadiness.exactAlarm !== "granted"
          ? await services.reminders.openExactAlarmSetting()
          : reminderReadiness.exactAlarm;

      setReminderReadiness({ notification, exactAlarm });
      if (notification === "granted" && exactAlarm === "granted") {
        setReminderDelivery("syncing");
        const result = await services.reminders.flush();
        setReminderDelivery(
          hasReminderSyncIssues(result) ? "degraded" : "ready",
        );
      } else {
        setReminderDelivery("idle");
      }
    } catch {
      setReminderReadiness({ notification: "error", exactAlarm: "error" });
      setReminderDelivery("degraded");
    } finally {
      setIsReminderBusy(false);
    }
  }

  async function handleWorkoutEvent(
    event: WorkoutEvent,
  ): Promise<WorkoutTransition> {
    if (!workout) throw new Error("No active workout");
    const transition = await services.workouts.apply(workout.id, event);
    setWorkout(transition.state);
    if (transition.kind === "changed") {
      if (transition.facts.some((fact) => fact.type === "REST_FINISHED")) {
        void services.reminders.notifyRestEnded().catch(() => undefined);
      }
      if (
        reminderReadiness.notification === "granted" &&
        reminderReadiness.exactAlarm === "granted"
      ) {
        void services.reminders
          .flush()
          .then((result) =>
            setReminderDelivery(
              hasReminderSyncIssues(result) ? "degraded" : "ready",
            ),
          )
          .catch(() => setReminderDelivery("degraded"));
      }
    }
    return transition;
  }

  const showingWorkout = screen === "workout" && workout !== null;

  useEffect(() => {
    function handlePredictiveBack(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isPredictiveBackEvent(detail)) return;

      if (nestedBackAvailableRef.current) {
        window.dispatchEvent(
          new CustomEvent(NESTED_PREDICTIVE_BACK_EVENT, { detail }),
        );
        if (detail.type === "invoked") requestBackRef.current();
        return;
      }

      if (detail.type === "started" || detail.type === "progress") {
        setBackGestureProgress(detail.progress);
        return;
      }

      setBackGestureProgress(0);
      if (detail.type === "invoked") requestBackRef.current();
    }

    window.addEventListener(PREDICTIVE_BACK_EVENT, handlePredictiveBack);
    return () =>
      window.removeEventListener(PREDICTIVE_BACK_EVENT, handlePredictiveBack);
  }, []);

  function requestBack() {
    if (workoutExitDialog === "save") {
      setWorkoutExitDialog("exit");
      return;
    }
    if (workoutExitDialog === "exit") {
      setWorkoutExitDialog(null);
      return;
    }
    if (nestedBackHandlerRef.current?.()) return;
    if (dismissFocusedTextInput()) return;

    if (showingWorkout) {
      setWorkoutExitDialog("exit");
      return;
    }
    if (screen === "plan-builder") {
      setScreen(activePlan ? "today" : "home");
      return;
    }
    void services.navigation.exitApp().catch(() => undefined);
  }

  useEffect(() => {
    requestBackRef.current = requestBack;
  });

  async function endWorkout(save: boolean) {
    if (!workout || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      await services.workouts.end(workout.id, { save });
      setWorkout(null);
      setWorkoutExitDialog(null);
      setScreen(activePlan ? "today" : "home");
    } catch {
      setError("训练状态未能结束，请稍后重试。");
      setWorkoutExitDialog(null);
    } finally {
      setIsBusy(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.pointerType === "mouse" ||
      event.clientX > 24 ||
      nestedBackAvailableRef.current
    ) {
      return;
    }
    edgeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = edgeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = Math.max(0, event.clientX - gesture.startX);
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.active && Math.abs(deltaY) > deltaX) {
      edgeGestureRef.current = null;
      return;
    }
    if (!gesture.active && deltaX < 8) return;

    gesture.active = true;
    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setBackGestureProgress(Math.min(1, deltaX / (window.innerWidth * 0.32)));
  }

  function finishEdgeGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = edgeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    edgeGestureRef.current = null;
    const shouldGoBack = gesture.active && backGestureProgress >= 0.35;
    setBackGestureProgress(0);
    if (shouldGoBack) requestBack();
  }

  function handleInteractionClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(
      "button, a[href], select, input[type='checkbox'], input[type='radio'], [role='button'], [role='tab']",
    );
    if (!control || !event.currentTarget.contains(control)) return;
    if (control.matches(":disabled, [aria-disabled='true']")) return;
    void interactionFeedback.playTap().catch(() => undefined);
  }

  return (
    <div
      className={`${showingWorkout ? "app-workout-host" : "app"} app-back-gesture`}
      ref={appRef}
      onClickCapture={handleInteractionClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishEdgeGesture}
      onPointerCancel={finishEdgeGesture}
    >
      {backGestureProgress > 0 ? (
        <BackGesturePreview screen={screen} plan={activePlan} />
      ) : null}
      <div
        className={`app-back-gesture__current${
          backGestureProgress > 0 ? " app-back-gesture__current--dragging" : ""
        }`}
        style={
          backGestureProgress > 0
            ? {
                transform: `translateX(${Math.round(backGestureProgress * 100)}%)`,
              }
            : undefined
        }
      >
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
                existingDraft={activePlan?.draft ?? null}
                initialMode={activePlan?.draft.source.kind ?? "generated"}
                isBusy={isBusy}
                onBack={requestBack}
                onNestedBackRequestChange={(handler) => {
                  nestedBackHandlerRef.current = handler;
                }}
                onNestedBackAvailabilityChange={(available) => {
                  nestedBackAvailableRef.current = available;
                }}
                onGenerated={setPlanDraft}
                onManualCreated={(draft) => void savePlan(draft)}
                onSave={() => void savePlan()}
              />
            ) : null}

            {screen === "today" && activePlan ? (
              <TodayScreen
                plan={activePlan}
                isBusy={isBusy}
                isReminderBusy={isReminderBusy}
                reminderDelivery={reminderDelivery}
                reminderReadiness={reminderReadiness}
                selectedDayIndex={selectedDayIndex}
                onEdit={() => {
                  setPlanDraft(null);
                  setScreen("plan-builder");
                }}
                onEnableReminders={() => void enableReminders()}
                onSelectDay={setSelectedDayIndex}
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
      {workoutExitDialog ? (
        <WorkoutExitConfirmation
          isBusy={isBusy}
          step={workoutExitDialog}
          completedSets={workout?.performedSets.length ?? 0}
          onCancel={() => setWorkoutExitDialog(null)}
          onContinueToSave={() => setWorkoutExitDialog("save")}
          onEnd={(save) => void endWorkout(save)}
        />
      ) : null}
    </div>
  );
}

function BackGesturePreview({
  screen,
  plan,
}: {
  screen: AppScreen;
  plan: StoredPlan | null;
}) {
  const target =
    screen === "workout" || screen === "plan-builder"
      ? plan
        ? "today"
        : "home"
      : null;
  if (!target) return null;

  return (
    <div className="app-back-gesture__preview" aria-hidden="true" inert>
      {target === "home" ? <LandingScreen onCreate={() => undefined} /> : null}
      {target === "today" && plan ? (
        <TodayScreen
          plan={plan}
          isBusy={false}
          isReminderBusy={false}
          reminderDelivery="idle"
          reminderReadiness={{ notification: "unsupported", exactAlarm: "unsupported" }}
          selectedDayIndex={0}
          onEdit={() => undefined}
          onEnableReminders={() => undefined}
          onSelectDay={() => undefined}
          onStart={() => undefined}
        />
      ) : null}
    </div>
  );
}

function WorkoutExitConfirmation({
  step,
  completedSets,
  isBusy,
  onCancel,
  onContinueToSave,
  onEnd,
}: {
  step: Exclude<WorkoutExitDialog, null>;
  completedSets: number;
  isBusy: boolean;
  onCancel: () => void;
  onContinueToSave: () => void;
  onEnd: (save: boolean) => void;
}) {
  const isSaveStep = step === "save";

  return (
    <div className="app-dialog-backdrop" role="presentation">
      <section
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-exit-title"
      >
        <p className="app-dialog__eyebrow">训练进行中</p>
        <h2 id="workout-exit-title">
          {isSaveStep ? "保存本次训练数据？" : "结束本次训练？"}
        </h2>
        <p>
          {isSaveStep
            ? `本次已完成 ${completedSets} 组。保存后会保留为“提前结束”的训练记录。`
            : "训练将停止，休息倒计时也会一并取消。"}
        </p>
        <div className="app-dialog__actions">
          {isSaveStep ? (
            <>
              <button type="button" disabled={isBusy} onClick={() => onEnd(false)}>
                不保存
              </button>
              <button
                className="app-dialog__primary"
                type="button"
                disabled={isBusy}
                onClick={() => onEnd(true)}
              >
                保存训练记录
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={isBusy} onClick={onCancel}>
                继续训练
              </button>
              <button
                className="app-dialog__primary"
                type="button"
                disabled={isBusy}
                onClick={onContinueToSave}
              >
                结束训练
              </button>
            </>
          )}
        </div>
      </section>
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
  existingDraft,
  initialMode,
  isBusy,
  onBack,
  onNestedBackRequestChange,
  onNestedBackAvailabilityChange,
  onGenerated,
  onManualCreated,
  onSave,
}: {
  draft: PlanDraft | null;
  existingDraft: PlanDraft | null;
  initialMode: PlanDraft["source"]["kind"];
  isBusy: boolean;
  onBack: () => void;
  onNestedBackRequestChange: (handler: (() => boolean) | null) => void;
  onNestedBackAvailabilityChange: (available: boolean) => void;
  onGenerated: (draft: GeneratedPlanDraft) => void;
  onManualCreated: (draft: Extract<PlanDraft, { source: { kind: "manual" } }>) => void;
  onSave: () => void;
}) {
  const [mode, setMode] = useState<PlanDraft["source"]["kind"]>(initialMode);
  const generatedDraft = isGeneratedPlanDraft(draft)
    ? draft
    : isGeneratedPlanDraft(existingDraft)
      ? existingDraft
      : null;

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
          <PlanGenerationForm
            initialPlan={generatedDraft}
            onPlanGenerated={onGenerated}
          />
        </div>
      ) : (
        <div
          aria-labelledby="manual-plan-tab"
          className="js-screen-reveal"
          id="manual-plan-panel"
          role="tabpanel"
        >
          <ManualPlanForm
            initialPlan={
              isManualPlanDraft(existingDraft) ? existingDraft : undefined
            }
            isSubmitting={isBusy}
            onPlanCreated={onManualCreated}
            onBrowserBackRequestChange={onNestedBackRequestChange}
            onBrowserBackAvailabilityChange={onNestedBackAvailabilityChange}
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

function isManualPlanDraft(
  draft: PlanDraft | null,
): draft is ManualPlanDraft {
  return draft?.source.kind === "manual";
}

function isGeneratedPlanDraft(
  draft: PlanDraft | null,
): draft is GeneratedPlanDraft {
  return draft?.source.kind === "generated";
}

function dismissFocusedTextInput(): boolean {
  const active = document.activeElement;
  if (
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    active instanceof HTMLInputElement &&
      !["button", "checkbox", "radio", "range", "submit"].includes(active.type)
  ) {
    active.blur();
    return true;
  }
  return active instanceof HTMLElement && active.isContentEditable
    ? (active.blur(), true)
    : false;
}

function TodayScreen({
  plan,
  isBusy,
  isReminderBusy,
  reminderDelivery,
  reminderReadiness,
  selectedDayIndex,
  onEdit,
  onEnableReminders,
  onSelectDay,
  onStart,
}: {
  plan: StoredPlan;
  isBusy: boolean;
  isReminderBusy: boolean;
  reminderDelivery: ReminderDeliveryState;
  reminderReadiness: ReminderReadiness;
  selectedDayIndex: number;
  onEdit: () => void;
  onEnableReminders: () => void;
  onSelectDay: (dayIndex: number) => void;
  onStart: () => void;
}) {
  const safeDayIndex = plan.draft.days[selectedDayIndex] ? selectedDayIndex : 0;
  const day = plan.draft.days[safeDayIndex]!;
  const estimatedMinutes = estimateMinutes(day.exercises);

  return (
    <div className="today-screen">
      {plan.draft.days.length > 1 ? (
        <label className="today-day-picker js-screen-reveal">
          <span>选择训练日</span>
          <select
            value={safeDayIndex}
            onChange={(event) =>
              onSelectDay(Number(event.currentTarget.value))
            }
          >
            {plan.draft.days.map((planDay, dayIndex) => (
              <option key={planDay.ordinal} value={dayIndex}>
                第 {planDay.ordinal} 天 · {planDay.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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

      <ReminderReadinessCard
        delivery={reminderDelivery}
        isBusy={isReminderBusy}
        readiness={reminderReadiness}
        onEnable={onEnableReminders}
      />

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

function ReminderReadinessCard({
  delivery,
  isBusy,
  readiness,
  onEnable,
}: {
  delivery: ReminderDeliveryState;
  isBusy: boolean;
  readiness: ReminderReadiness;
  onEnable: () => void;
}) {
  const isChecking =
    readiness.notification === "checking" ||
    readiness.exactAlarm === "checking" ||
    delivery === "syncing";
  const isUnsupported =
    readiness.notification === "unsupported" ||
    readiness.exactAlarm === "unsupported";
  const isReady =
    readiness.notification === "granted" &&
    readiness.exactAlarm === "granted" &&
    delivery === "ready";
  const hasError =
    readiness.notification === "error" || readiness.exactAlarm === "error";
  const isDegraded = delivery === "degraded";

  let title = "正在检查提醒能力";
  let copy = "训练仍可随时开始。";
  if (isDegraded && !isUnsupported) {
    title = "后台提醒需要重试";
    copy = "系统提醒本次未能安排；前台倒计时仍可用，稍后可重新同步。";
  } else if (isReady) {
    title = "后台提醒已开启";
    copy = "休息结束时会发送系统通知，并在前台播放声音与震动。";
  } else if (isUnsupported) {
    title = "浏览器前台提醒";
    copy = "Chrome 预览会在页面打开时提醒；安装 APK 后可开启后台系统通知。";
  } else if (hasError) {
    title = "提醒状态暂时不可用";
    copy = "训练记录不受影响；你仍可依靠前台倒计时。";
  } else if (!isChecking) {
    title = "后台提醒尚未开启";
    copy = "开启系统通知和精确提醒，锁屏时也能掌握组间休息。";
  }

  return (
    <section className="reminder-readiness js-screen-reveal" aria-label="休息提醒状态">
      <BellRing size={19} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
      {!isReady && !isUnsupported ? (
        <button
          type="button"
          disabled={isBusy || isChecking}
          onClick={onEnable}
        >
          {isBusy
            ? "正在处理…"
            : isDegraded || hasError
              ? "重试提醒"
              : "开启休息提醒"}
        </button>
      ) : null}
    </section>
  );
}

function snapshotFromPlan(
  plan: StoredPlan,
  dayIndex: number,
): WorkoutPlanSnapshot {
  const day = plan.draft.days[dayIndex];
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

function hasReminderSyncIssues(
  result: Awaited<ReturnType<AppServices["reminders"]["flush"]>>,
): boolean {
  return result.failures.length > 0 || result.unsupportedJobIds.length > 0;
}
