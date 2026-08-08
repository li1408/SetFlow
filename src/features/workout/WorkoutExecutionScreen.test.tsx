import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  WorkoutEvent,
  WorkoutSession,
  WorkoutTransition,
} from "../../domain/workout/types";
import { WorkoutExecutionScreen } from "./WorkoutExecutionScreen";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("WorkoutExecutionScreen", () => {
  it("submits one stable complete-set event while the action is pending", async () => {
    const session = makeActiveSession();
    const pending = deferred<WorkoutTransition>();
    const onEvent = vi.fn(() => pending.promise);
    const user = userEvent.setup();

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    const reps = screen.getByLabelText("实际次数");
    const weight = screen.getByLabelText("附加重量（千克）");
    await user.clear(reps);
    await user.type(reps, "10");
    await user.type(weight, "6.5");

    const completeButton = screen.getByRole("button", { name: "完成本组" });
    fireEvent.click(completeButton);
    fireEvent.click(completeButton);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "complete_set",
        expectedPosition: { exerciseIndex: 0, setIndex: 0 },
        performedSetId: expect.stringMatching(/^set-/),
        restTimerId: expect.stringMatching(/^rest-/),
        actual: { kind: "reps", reps: 10, additionalWeightKg: 6.5 },
      }),
    );
    expect(completeButton).toBeDisabled();

    await act(async () => {
      pending.resolve(noop(session));
      await pending.promise;
    });
    await waitFor(() => expect(completeButton).toBeEnabled());
  });

  it("submits duration-based actual performance", async () => {
    const session = makeActiveSession({ targetKind: "durationSeconds" });
    const onEvent = vi.fn<(event: WorkoutEvent) => WorkoutTransition>(() =>
      noop(session),
    );
    const user = userEvent.setup();

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    const duration = screen.getByLabelText("实际时长（秒）");
    await user.clear(duration);
    await user.type(duration, "42");
    await user.click(screen.getByRole("button", { name: "完成本组" }));

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "complete_set",
        actual: { kind: "durationSeconds", seconds: 42 },
      }),
    );
    expect(screen.queryByLabelText("附加重量（千克）")).not.toBeInTheDocument();
  });

  it("shows absolute rest time and dispatches both adjustments and skip", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const session = makeRestingSession(31_000);
    const onEvent = vi.fn<(event: WorkoutEvent) => WorkoutTransition>(() =>
      noop(session),
    );

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    expect(screen.getByRole("timer")).toHaveTextContent("00:30");

    fireEvent.click(screen.getByRole("button", { name: "减少休息 15 秒" }));
    await act(async () => Promise.resolve());
    expect(onEvent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "增加休息 15 秒" }));
    await act(async () => Promise.resolve());
    expect(onEvent).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "跳过休息" }));
    await act(async () => Promise.resolve());

    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      {
        type: "adjust_rest",
        timerId: "rest-1",
        expectedRevision: 2,
        deltaSeconds: -15,
        at: 1_000,
      },
      {
        type: "adjust_rest",
        timerId: "rest-1",
        expectedRevision: 2,
        deltaSeconds: 15,
        at: 1_000,
      },
      {
        type: "skip_rest",
        timerId: "rest-1",
        expectedRevision: 2,
        at: 1_000,
      },
    ]);
  });

  it("dispatches rest elapsed only once when the persisted deadline passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const session = makeRestingSession(10_400);
    const onEvent = vi.fn(() => noop(session));

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "rest_elapsed",
      timerId: "rest-1",
      expectedRevision: 2,
      at: 10_500,
    });

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("retries an elapsed rest after a transient persistence failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const session = makeRestingSession(10_400);
    const onEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary IndexedDB failure"))
      .mockImplementation(() => noop(session));

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByText("操作失败，请重试。")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("stops automatic elapsed retries and offers a visible manual retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const session = makeRestingSession(10_400);
    const onEvent = vi
      .fn()
      .mockRejectedValue(new Error("persistent IndexedDB failure"));

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });

    expect(onEvent).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "休息已经结束，但训练进度暂时无法保存",
    );
    const retryButton = screen.getByRole("button", { name: "重试保存" });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(onEvent).toHaveBeenCalledTimes(4);

    onEvent.mockImplementation(() => noop(session));
    fireEvent.click(retryButton);
    await act(async () => Promise.resolve());
    expect(onEvent).toHaveBeenCalledTimes(5);
  });

  it("requires an explicit action before activating the next set", async () => {
    const session = makeActiveSession();
    session.phase = {
      kind: "next_set_ready",
      position: { exerciseIndex: 0, setIndex: 1 },
    };
    const onEvent = vi.fn(() => noop(session));
    const user = userEvent.setup();

    render(<WorkoutExecutionScreen session={session} onEvent={onEvent} />);

    const heading = screen.getByRole("heading", { name: "下一组已准备" });
    expect(heading).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "开始下一组" }));

    expect(onEvent).toHaveBeenCalledWith({
      type: "activate_next_set",
      expectedPosition: { exerciseIndex: 0, setIndex: 1 },
    });
  });

  it("summarizes a completed workout", () => {
    const session = makeActiveSession();
    session.phase = { kind: "completed", completedAt: 181_000 };
    session.startedAt = 1_000;
    session.performedSets = [
      makePerformedSet("set-1", 0),
      makePerformedSet("set-2", 1),
    ];

    const onFinish = vi.fn();
    render(
      <WorkoutExecutionScreen
        session={session}
        onEvent={vi.fn()}
        onFinish={onFinish}
      />,
    );

    expect(screen.getByRole("heading", { name: "训练完成" })).toBeInTheDocument();
    expect(screen.getByText("2 组")).toBeInTheDocument();
    expect(screen.getByText("1 个动作")).toBeInTheDocument();
    expect(screen.getByText("03:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回到今日计划" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

function makeActiveSession(options?: {
  targetKind?: "reps" | "durationSeconds";
}): WorkoutSession {
  const target =
    options?.targetKind === "durationSeconds"
      ? ({ kind: "durationSeconds", seconds: 30, basis: "total" } as const)
      : ({ kind: "reps", min: 8, max: 12, basis: "total" } as const);

  return {
    id: "workout-1",
    snapshot: {
      planId: "plan-1",
      planName: "居家全身 A",
      exercises: [
        {
          id: "squat",
          name: "自重深蹲",
          cue: "膝盖朝脚尖方向，躯干保持稳定。",
          sets: 3,
          target,
          restSeconds: 60,
        },
      ],
    },
    phase: {
      kind: "active_set",
      position: { exerciseIndex: 0, setIndex: 0 },
    },
    performedSets: [],
    startedAt: 1_000,
  };
}

function makeRestingSession(endsAt: number): WorkoutSession {
  const session = makeActiveSession();
  session.phase = {
    kind: "resting",
    completedPosition: { exerciseIndex: 0, setIndex: 0 },
    nextPosition: { exerciseIndex: 0, setIndex: 1 },
    timer: {
      id: "rest-1",
      revision: 2,
      sourceSetId: "set-1",
      startedAt: 1_000,
      endsAt,
      totalAdjustmentSeconds: 30,
    },
  };
  return session;
}

function makePerformedSet(id: string, setIndex: number) {
  return {
    id,
    exerciseId: "squat",
    position: { exerciseIndex: 0, setIndex },
    target: { kind: "reps", min: 8, max: 12, basis: "total" } as const,
    actual: { kind: "reps", reps: 10, additionalWeightKg: null } as const,
    completedAt: 1_000 + setIndex * 60_000,
  };
}

function noop(session: WorkoutSession): WorkoutTransition {
  return { kind: "noop", state: session, reason: "REST_NOT_DUE" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
