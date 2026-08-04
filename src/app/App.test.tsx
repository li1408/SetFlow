import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredPlan } from "../data/types";
import { createWorkoutSession, transitionWorkout } from "../domain/workout/workout-machine";
import type {
  WorkoutEvent,
  WorkoutSession,
} from "../domain/workout/types";
import { App } from "./App";
import type { AppServices } from "./services";

afterEach(cleanup);

describe("App", () => {
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

    await user.click(screen.getByRole("button", { name: "开始今天训练" }));
    expect(
      await screen.findByRole("heading", { name: "徒手深蹲" }),
    ).toBeInTheDocument();
    expect(services.workouts.create).toHaveBeenCalledTimes(1);
    expect(services.workouts.apply).toHaveBeenCalledWith(
      "workout-id",
      { type: "start", at: 1_000 },
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
      create: vi.fn(async (session) => {
        currentWorkout = session;
      }),
      apply: vi.fn(async (_workoutId: string, event: WorkoutEvent) => {
        if (!currentWorkout) throw new Error("workout was not created");
        const transition = transitionWorkout(currentWorkout, event);
        currentWorkout = transition.state;
        return transition;
      }),
    },
    now: () => 1_000,
    createId: () => ids.shift() ?? "fallback-id",
  };
}
