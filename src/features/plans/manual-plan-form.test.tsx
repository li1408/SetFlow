import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planDraftSchema } from "../../domain/planning/schemas";
import { ManualPlanForm } from "./manual-plan-form";

afterEach(cleanup);

describe("ManualPlanForm", () => {
  it("starts with one named training day and bodyweight squat selected", () => {
    render(<ManualPlanForm onPlanCreated={vi.fn()} />);

    expect(
      screen.getByRole("form", { name: "手动创建计划" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("训练日名称")).toHaveValue("居家全身训练");

    const squatEditor = screen.getByRole("group", { name: "徒手深蹲设置" });
    expect(within(squatEditor).getByLabelText("组数")).toHaveValue(3);
    expect(within(squatEditor).getByLabelText("最少次数")).toHaveValue(8);
    expect(within(squatEditor).getByLabelText("最多次数")).toHaveValue(12);
    expect(within(squatEditor).getByLabelText("组间休息（秒）")).toHaveValue(
      60,
    );
  });

  it("adds a duration exercise and exposes the correct target editor", async () => {
    const user = userEvent.setup();
    render(<ManualPlanForm onPlanCreated={vi.fn()} />);

    const exerciseBrowser = screen.getByRole("region", { name: "选择动作" });
    await user.click(
      within(exerciseBrowser).getByRole("button", { name: "徒手" }),
    );
    await user.click(
      within(exerciseBrowser).getByRole("button", { name: "继续" }),
    );
    await user.click(
      within(exerciseBrowser).getByRole("button", { name: "选择核心" }),
    );
    await user.click(
      within(exerciseBrowser).getByRole("button", { name: "继续" }),
    );
    await user.click(
      within(exerciseBrowser).getByRole("button", {
        name: "查看前臂平板支撑",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "添加前臂平板支撑" }),
    );

    const plankEditor = screen.getByRole("group", { name: "前臂平板支撑设置" });
    expect(within(plankEditor).getByLabelText("每组时长（秒）")).toHaveValue(
      30,
    );
    expect(
      within(plankEditor).queryByLabelText("最少次数"),
    ).not.toBeInTheDocument();
  });

  it("submits an edited manual draft after schema validation", async () => {
    const user = userEvent.setup();
    const onPlanCreated = vi.fn();
    render(<ManualPlanForm onPlanCreated={onPlanCreated} />);

    await user.clear(screen.getByLabelText("训练日名称"));
    await user.type(screen.getByLabelText("训练日名称"), "周一 · 下肢与核心");

    const squatEditor = screen.getByRole("group", { name: "徒手深蹲设置" });
    await user.clear(within(squatEditor).getByLabelText("组数"));
    await user.type(within(squatEditor).getByLabelText("组数"), "4");
    await user.clear(within(squatEditor).getByLabelText("最少次数"));
    await user.type(within(squatEditor).getByLabelText("最少次数"), "10");
    await user.clear(within(squatEditor).getByLabelText("最多次数"));
    await user.type(within(squatEditor).getByLabelText("最多次数"), "15");
    await user.clear(within(squatEditor).getByLabelText("组间休息（秒）"));
    await user.type(within(squatEditor).getByLabelText("组间休息（秒）"), "75");
    await user.click(screen.getByRole("button", { name: "保存手动计划" }));

    expect(onPlanCreated).toHaveBeenCalledTimes(1);
    const plan = onPlanCreated.mock.calls[0]?.[0];
    expect(planDraftSchema.safeParse(plan).success).toBe(true);
    expect(plan).toEqual({
      source: { kind: "manual" },
      days: [
        {
          ordinal: 1,
          name: "周一 · 下肢与核心",
          exercises: [
            {
              exerciseId: "bodyweight-squat",
              order: 0,
              sets: 4,
              target: { kind: "reps", min: 10, max: 15, basis: "total" },
              restSeconds: 75,
            },
          ],
        },
      ],
    });
  });

  it("can remove an exercise and reports invalid empty plans accessibly", async () => {
    const user = userEvent.setup();
    const onPlanCreated = vi.fn();
    render(<ManualPlanForm onPlanCreated={onPlanCreated} />);

    await user.click(screen.getByRole("button", { name: "移除徒手深蹲" }));
    expect(
      screen.queryByRole("group", { name: "徒手深蹲设置" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存手动计划" }));

    expect(screen.getByRole("alert")).toHaveTextContent("至少选择一个动作");
    expect(onPlanCreated).not.toHaveBeenCalled();
  });

  it("prefills an existing manual plan for editing", () => {
    render(
      <ManualPlanForm
        initialPlan={{
          source: { kind: "manual" },
          days: [
            {
              ordinal: 1,
              name: "小米 15 徒手训练",
              exercises: [
                {
                  exerciseId: "bodyweight-squat",
                  order: 0,
                  sets: 4,
                  target: {
                    kind: "reps",
                    min: 10,
                    max: 14,
                    basis: "total",
                  },
                  restSeconds: 75,
                },
                {
                  exerciseId: "forearm-plank",
                  order: 1,
                  sets: 3,
                  target: {
                    kind: "durationSeconds",
                    seconds: 45,
                    basis: "total",
                  },
                  restSeconds: 45,
                },
              ],
            },
          ],
        }}
        onPlanCreated={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("训练日名称")).toHaveValue("小米 15 徒手训练");
    const squatEditor = screen.getByRole("group", { name: "徒手深蹲设置" });
    expect(within(squatEditor).getByLabelText("组数")).toHaveValue(4);
    expect(within(squatEditor).getByLabelText("最少次数")).toHaveValue(10);
    const plankEditor = screen.getByRole("group", { name: "前臂平板支撑设置" });
    expect(within(plankEditor).getByLabelText("每组时长（秒）")).toHaveValue(
      45,
    );
  });
});
