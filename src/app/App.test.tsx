import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredPlan } from "../data/types";
import { createWorkoutSession, transitionWorkout } from "../domain/workout/workout-machine";
import type {
  WorkoutEvent,
  WorkoutSession,
} from "../domain/workout/types";
import type { InteractionFeedbackPlayer } from "../native/interaction-feedback";
import { App } from "./App";
import type { AppServices } from "./services";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("plays tap feedback for actionable controls", async () => {
    const services = createServices();
    const interactionFeedback: InteractionFeedbackPlayer = {
      playTap: vi.fn(async () => ({
        sound: "played" as const,
        haptics: "played" as const,
      })),
    };
    const user = userEvent.setup();
    render(
      <App
        services={services}
        interactionFeedback={interactionFeedback}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "创建我的计划" }),
    );

    expect(interactionFeedback.playTap).toHaveBeenCalledOnce();
  });

  it("does not subscribe screen reveals to keyboard-driven viewport height changes", async () => {
    const mediaQueries: string[] = [];
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => {
        mediaQueries.push(query);
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        };
      }),
    );
    const services = createServices();
    const user = userEvent.setup();

    render(<App services={services} />);
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "创建我的计划" }));
    const daysPerWeek = screen.getByLabelText("每周训练天数");
    await user.click(daysPerWeek);

    expect(daysPerWeek).toHaveFocus();
    expect(mediaQueries).not.toContain("(max-height: 700px)");
  });

  it("presents the local-first primary action when no plan exists", async () => {
    const services = createServices();
    render(<App services={services} />);

    expect(
      screen.getByRole("heading", { name: "今天，开始动起来" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "创建我的计划" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());
  });

  it("generates, saves and starts a bodyweight workout", async () => {
    const services = createServices();
    const user = userEvent.setup();
    render(<App services={services} />);
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "创建我的计划" }));
    expect(
      screen.getByRole("heading", { name: "离线规则生成计划" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "生成离线计划" }));
    await user.click(
      screen.getByRole("button", { name: "保存并使用这个计划" }),
    );

    expect(
      await screen.findByRole("heading", { name: "全身训练 A" }),
    ).toBeInTheDocument();
    expect(services.plans.saveActive).toHaveBeenCalledTimes(1);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "选择训练日" }),
      "1",
    );
    expect(
      screen.getByRole("heading", { name: "全身训练 B" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开始今天训练" }));
    expect(
      await screen.findByRole("heading", { name: "徒手髋折叠前伸" }),
    ).toBeInTheDocument();
    expect(services.workouts.start).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(services.workouts.start).mock.calls[0]?.[0].snapshot.planName,
    ).toBe("全身训练 B");
    expect(services.workouts.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workout-id" }),
      1_000,
    );
  });

  it("creates and saves a manual plan from the same plan builder", async () => {
    const services = createServices();
    const user = userEvent.setup();
    render(<App services={services} />);
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "创建我的计划" }));
    await user.click(screen.getByRole("tab", { name: "手动创建" }));
    await user.click(screen.getByRole("button", { name: "保存手动计划" }));

    expect(
      await screen.findByRole("heading", { name: "居家全身训练" }),
    ).toBeInTheDocument();
    expect(services.plans.saveActive).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ source: { kind: "manual" } }),
      }),
    );
  });

  it("keeps a generated draft visible after switching plan modes", async () => {
    const services = createServices();
    const user = userEvent.setup();
    render(<App services={services} />);
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "创建我的计划" }));
    await user.click(screen.getByRole("button", { name: "生成离线计划" }));
    await user.click(screen.getByRole("tab", { name: "手动创建" }));
    await user.click(screen.getByRole("tab", { name: "规则生成" }));

    expect(
      screen.getByRole("heading", { name: "计划预览" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "保存并使用这个计划" }),
    ).toBeInTheDocument();
  });

  it("prefills and saves edits to an existing generated plan", async () => {
    const services = createServices();
    vi.mocked(services.plans.getActive).mockResolvedValue(storedPlanFixture());
    const user = userEvent.setup();
    render(<App services={services} />);

    await user.click(
      await screen.findByRole("button", { name: "调整训练计划" }),
    );
    const editor = screen.getByRole("group", { name: "徒手深蹲设置" });
    const sets = within(editor).getByLabelText("组数");
    await user.clear(sets);
    await user.type(sets, "3");
    await user.click(
      screen.getByRole("button", { name: "保存并使用这个计划" }),
    );

    expect(services.plans.saveActive).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          source: { kind: "generated", ruleVersion: "v1" },
          days: [
            expect.objectContaining({
              exercises: [expect.objectContaining({ sets: 3 })],
            }),
          ],
        }),
      }),
    );
  });

  it("requests notification and exact alarm access only after a user action", async () => {
    const services = createServices();
    vi.mocked(services.plans.getActive).mockResolvedValue(storedPlanFixture());
    vi.mocked(services.reminders.checkPermission).mockResolvedValue("prompt");
    vi.mocked(services.reminders.checkExactAlarmSetting).mockResolvedValue(
      "denied",
    );
    vi.mocked(services.reminders.requestPermission).mockResolvedValue(
      "granted",
    );
    vi.mocked(services.reminders.openExactAlarmSetting).mockResolvedValue(
      "granted",
    );

    const user = userEvent.setup();
    render(<App services={services} />);

    const enableButton = await screen.findByRole("button", {
      name: "开启休息提醒",
    });
    expect(services.reminders.requestPermission).not.toHaveBeenCalled();
    expect(services.reminders.openExactAlarmSetting).not.toHaveBeenCalled();

    await user.click(enableButton);

    await waitFor(() =>
      expect(screen.getByText("后台提醒已开启")).toBeInTheDocument(),
    );
    expect(services.reminders.requestPermission).toHaveBeenCalledOnce();
    expect(services.reminders.openExactAlarmSetting).toHaveBeenCalledOnce();
    expect(services.reminders.flush).toHaveBeenCalledOnce();
  });

  it("flushes reminder jobs and plays foreground feedback when rest ends", async () => {
    const services = createServices();
    vi.mocked(services.plans.getActive).mockResolvedValue(storedPlanFixture(0));
    vi.mocked(services.reminders.checkPermission).mockResolvedValue("granted");
    vi.mocked(services.reminders.checkExactAlarmSetting).mockResolvedValue(
      "granted",
    );
    const user = userEvent.setup();
    render(<App services={services} />);

    await screen.findByText("后台提醒已开启");
    await waitFor(() => expect(services.reminders.flush).toHaveBeenCalled());
    const initialFlushCount = vi.mocked(services.reminders.flush).mock.calls
      .length;

    await user.click(screen.getByRole("button", { name: "开始今天训练" }));
    await user.click(await screen.findByRole("button", { name: "完成本组" }));

    await waitFor(() =>
      expect(services.reminders.notifyRestEnded).toHaveBeenCalledOnce(),
    );
    expect(vi.mocked(services.reminders.flush).mock.calls.length).toBeGreaterThan(
      initialFlushCount,
    );
  });

  it("resumes a persisted active workout on launch", async () => {
    const services = createServices();
    const active = createWorkoutSession("persisted-workout", snapshot);
    const started = transitionWorkout(active, { type: "start", at: 500 });
    if (started.kind !== "changed") throw new Error("fixture did not start");
    vi.mocked(services.workouts.recoverActive).mockResolvedValue(started.state);

    render(<App services={services} />);

    expect(
      await screen.findByRole("heading", { name: "徒手深蹲" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第 1 / 2 组")).toBeInTheDocument();
  });

  it("initializes granted reminders while resuming an active workout", async () => {
    const services = createServices();
    const active = createWorkoutSession("persisted-workout", snapshot);
    const started = transitionWorkout(active, { type: "start", at: 500 });
    if (started.kind !== "changed") throw new Error("fixture did not start");
    vi.mocked(services.workouts.recoverActive).mockResolvedValue(started.state);
    vi.mocked(services.reminders.checkPermission).mockResolvedValue("granted");
    vi.mocked(services.reminders.checkExactAlarmSetting).mockResolvedValue(
      "granted",
    );

    render(<App services={services} />);

    expect(
      await screen.findByRole("heading", { name: "徒手深蹲" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(services.reminders.flush).toHaveBeenCalled());
  });

  it("returns to the recovered workout day after finishing", async () => {
    const services = createServices();
    const plan = storedPlanFixture(0);
    plan.draft.days.push({
      ordinal: 2,
      name: "全身训练 B",
      exercises: plan.draft.days[0]!.exercises.map((exercise) => ({
        ...exercise,
        sets: 1,
      })),
    });
    vi.mocked(services.plans.getActive).mockResolvedValue(plan);
    const active = createWorkoutSession("persisted-workout", {
      ...snapshot,
      planName: "全身训练 B",
      exercises: [{ ...snapshot.exercises[0]!, sets: 1, restSeconds: 0 }],
    });
    const started = transitionWorkout(active, { type: "start", at: 500 });
    if (started.kind !== "changed") throw new Error("fixture did not start");
    vi.mocked(services.workouts.recoverActive).mockResolvedValue(started.state);
    let recoveredState = started.state;
    vi.mocked(services.workouts.apply).mockImplementation(async (_id, event) => {
      const transition = transitionWorkout(recoveredState, event);
      recoveredState = transition.state;
      return transition;
    });
    const user = userEvent.setup();

    render(<App services={services} />);
    await user.click(
      await screen.findByRole("button", { name: "完成本组" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "回到今日计划" }),
    );

    expect(
      screen.getByRole("heading", { name: "全身训练 B" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择训练日" })).toHaveValue(
      "1",
    );
  });

  it("shows a retry state when native reminder synchronization fails", async () => {
    const services = createServices();
    vi.mocked(services.plans.getActive).mockResolvedValue(storedPlanFixture());
    vi.mocked(services.reminders.checkPermission).mockResolvedValue("granted");
    vi.mocked(services.reminders.checkExactAlarmSetting).mockResolvedValue(
      "granted",
    );
    vi.mocked(services.reminders.flush).mockResolvedValue({
      ...emptyReminderSyncResult(),
      failures: [{ jobId: "rest-1:0:schedule", stage: "apply" }],
    });

    render(<App services={services} />);

    expect(await screen.findByText("后台提醒需要重试")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重试提醒" }),
    ).toBeInTheDocument();
  });

  it("rechecks and rebuilds reminders whenever the app returns to foreground", async () => {
    const services = createServices();
    vi.mocked(services.plans.getActive).mockResolvedValue(storedPlanFixture());
    vi.mocked(services.reminders.checkPermission).mockResolvedValue("granted");
    vi.mocked(services.reminders.checkExactAlarmSetting).mockResolvedValue(
      "granted",
    );
    let foregroundListener: (() => void) | undefined;
    vi.mocked(services.lifecycle.onForeground).mockImplementation(
      async (listener) => {
        foregroundListener = listener;
        return () => undefined;
      },
    );

    render(<App services={services} />);
    await waitFor(() => expect(services.reminders.flush).toHaveBeenCalledOnce());

    foregroundListener?.();

    await waitFor(() =>
      expect(services.reminders.checkPermission).toHaveBeenCalledTimes(2),
    );
    expect(services.reminders.flush).toHaveBeenCalledTimes(2);
  });

  it("waits for workout recovery before rebuilding native reminders", async () => {
    const services = createServices();
    let finishRecovery: (workout: WorkoutSession | null) => void = () =>
      undefined;
    vi.mocked(services.workouts.recoverActive).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRecovery = resolve;
        }),
    );

    render(<App services={services} />);
    await waitFor(() => expect(services.plans.getActive).toHaveBeenCalled());
    expect(services.reminders.checkPermission).not.toHaveBeenCalled();

    finishRecovery(null);

    await waitFor(() =>
      expect(services.reminders.checkPermission).toHaveBeenCalledOnce(),
    );
  });
});

const snapshot = {
  planId: "plan-id",
  planName: "全身训练 A",
  exercises: [
    {
      id: "bodyweight-squat",
      name: "徒手深蹲",
      cue: "脚掌稳稳踩地，膝盖跟随脚尖方向下蹲。",
      sets: 2,
      target: { kind: "reps", min: 8, max: 12, basis: "total" },
      restSeconds: 60,
    },
  ],
} satisfies WorkoutSession["snapshot"];

function createServices(): AppServices {
  let currentWorkout: WorkoutSession | null = null;
  const ids = ["plan-id", "workout-id"];

  return {
    plans: {
      getActive: vi.fn(async () => null),
      saveActive: vi.fn(async (input) =>
        ({
          ...input,
          status: "active",
          activeSlot: "active",
          createdAt: 1_000,
          updatedAt: 1_000,
          schemaVersion: 1,
        }) satisfies StoredPlan,
      ),
    },
    workouts: {
      recoverActive: vi.fn(async () => null),
      start: vi.fn(async (session, at) => {
        const transition = transitionWorkout(session, { type: "start", at });
        currentWorkout = transition.state;
        return transition;
      }),
      apply: vi.fn(async (_workoutId: string, event: WorkoutEvent) => {
        if (!currentWorkout) throw new Error("workout was not created");
        const transition = transitionWorkout(currentWorkout, event);
        currentWorkout = transition.state;
        return transition;
      }),
    },
    reminders: {
      checkPermission: vi.fn(async () => "unsupported" as const),
      requestPermission: vi.fn(async () => "unsupported" as const),
      checkExactAlarmSetting: vi.fn(async () => "unsupported" as const),
      openExactAlarmSetting: vi.fn(async () => "unsupported" as const),
      flush: vi.fn(async () => emptyReminderSyncResult()),
      notifyRestEnded: vi.fn(async () => undefined),
    },
    lifecycle: {
      onForeground: vi.fn(async () => () => undefined),
    },
    now: () => 1_000,
    createId: () => ids.shift() ?? "fallback-id",
  };
}

function emptyReminderSyncResult() {
  return {
    appliedJobIds: [],
    staleJobIds: [],
    unsupportedJobIds: [],
    compensatedNotificationIds: [],
    failures: [],
  };
}

function storedPlanFixture(restSeconds = 60): StoredPlan {
  return {
    id: "plan-id",
    name: "我的居家计划",
    draft: {
      source: { kind: "generated", ruleVersion: "v1" },
      days: [
        {
          ordinal: 1,
          name: "全身训练 A",
          exercises: [
            {
              exerciseId: "bodyweight-squat",
              order: 0,
              sets: 2,
              target: {
                kind: "reps",
                min: 8,
                max: 12,
                basis: "total",
              },
              restSeconds,
            },
          ],
        },
      ],
    },
    status: "active",
    activeSlot: "active",
    createdAt: 1_000,
    updatedAt: 1_000,
    schemaVersion: 1,
  };
}
