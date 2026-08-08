import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planDraftSchema } from "../../domain/planning/schemas";
import type { GeneratedPlanDraft } from "../../domain/planning/types";
import { PlanPreview } from "./plan-preview";

afterEach(cleanup);

const generatedPlan: GeneratedPlanDraft = {
  source: { kind: "generated", ruleVersion: "1.0.0" },
  days: [
    {
      ordinal: 1,
      name: "全身训练 A",
      exercises: [
        {
          exerciseId: "bodyweight-squat",
          order: 4,
          sets: 2,
          target: { kind: "reps", min: 8, max: 12, basis: "total" },
          restSeconds: 60,
        },
        {
          exerciseId: "hip-hinge-reach",
          order: 9,
          sets: 2,
          target: { kind: "reps", min: 8, max: 12, basis: "total" },
          restSeconds: 45,
        },
        {
          exerciseId: "forearm-plank",
          order: 12,
          sets: 2,
          target: {
            kind: "durationSeconds",
            seconds: 30,
            basis: "total",
          },
          restSeconds: 45,
        },
      ],
    },
  ],
};

function EditablePreview({
  initialPlan,
  onPlanChange,
}: {
  initialPlan: GeneratedPlanDraft;
  onPlanChange: (plan: GeneratedPlanDraft) => void;
}) {
  const [plan, setPlan] = useState(initialPlan);

  return (
    <PlanPreview
      plan={plan}
      onPlanChange={(nextPlan) => {
        onPlanChange(nextPlan);
        setPlan(nextPlan);
      }}
    />
  );
}

describe("PlanPreview", () => {
  it("renders the generated plan without edit controls when no callback is provided", () => {
    render(<PlanPreview plan={generatedPlan} />);

    expect(
      screen.getByRole("heading", { name: "计划预览" }),
    ).toBeInTheDocument();
    expect(screen.getByText("规则版本 1.0.0")).toBeInTheDocument();
    expect(screen.getByText("全身训练 A")).toBeInTheDocument();
    expect(screen.getByText("徒手深蹲")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("edits repetition targets and rest while emitting only valid normalized drafts", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    render(
      <EditablePreview
        initialPlan={generatedPlan}
        onPlanChange={onPlanChange}
      />,
    );

    const squatEditor = screen.getByRole("group", {
      name: "徒手深蹲设置",
    });
    await user.clear(within(squatEditor).getByLabelText("组数"));
    await user.type(within(squatEditor).getByLabelText("组数"), "4");
    await user.clear(within(squatEditor).getByLabelText("最少次数"));
    await user.type(within(squatEditor).getByLabelText("最少次数"), "10");
    await user.clear(within(squatEditor).getByLabelText("最多次数"));
    await user.type(within(squatEditor).getByLabelText("最多次数"), "15");
    await user.clear(within(squatEditor).getByLabelText("组间休息（秒）"));
    await user.type(within(squatEditor).getByLabelText("组间休息（秒）"), "75");

    const latestPlan = onPlanChange.mock.calls.at(-1)?.[0] as GeneratedPlanDraft;
    expect(latestPlan.days[0]?.exercises[0]).toMatchObject({
      exerciseId: "bodyweight-squat",
      order: 0,
      sets: 4,
      target: { kind: "reps", min: 10, max: 15, basis: "total" },
      restSeconds: 75,
    });
    expect(latestPlan.days[0]?.exercises.map((exercise) => exercise.order)).toEqual([
      0, 1, 2,
    ]);
    expect(
      onPlanChange.mock.calls.every(([plan]) =>
        planDraftSchema.safeParse(plan).success,
      ),
    ).toBe(true);
  });

  it("edits duration targets and moves exercises with continuous order values", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    render(
      <EditablePreview
        initialPlan={generatedPlan}
        onPlanChange={onPlanChange}
      />,
    );

    const plankEditor = screen.getByRole("group", {
      name: "前臂平板支撑设置",
    });
    await user.clear(within(plankEditor).getByLabelText("每组时长（秒）"));
    await user.type(
      within(plankEditor).getByLabelText("每组时长（秒）"),
      "45",
    );
    await user.click(
      within(plankEditor).getByRole("button", {
        name: "上移前臂平板支撑",
      }),
    );

    const latestPlan = onPlanChange.mock.calls.at(-1)?.[0] as GeneratedPlanDraft;
    expect(latestPlan.days[0]?.exercises.map((exercise) => exercise.exerciseId)).toEqual([
      "bodyweight-squat",
      "forearm-plank",
      "hip-hinge-reach",
    ]);
    expect(latestPlan.days[0]?.exercises.map((exercise) => exercise.order)).toEqual([
      0, 1, 2,
    ]);
    expect(latestPlan.days[0]?.exercises[1]?.target).toEqual({
      kind: "durationSeconds",
      seconds: 45,
      basis: "total",
    });
    expect(planDraftSchema.safeParse(latestPlan).success).toBe(true);
  });

  it("replaces an exercise with library defaults and excludes same-day duplicates", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    render(
      <EditablePreview
        initialPlan={generatedPlan}
        onPlanChange={onPlanChange}
      />,
    );

    const squatEditor = screen.getByRole("group", {
      name: "徒手深蹲设置",
    });
    const replacement = within(squatEditor).getByRole("combobox", {
      name: "替换动作",
    });
    expect(
      within(replacement).queryByRole("option", { name: "徒手髋折叠前伸" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(replacement, "side-plank");

    const latestPlan = onPlanChange.mock.calls.at(-1)?.[0] as GeneratedPlanDraft;
    expect(latestPlan.days[0]?.exercises[0]).toEqual({
      exerciseId: "side-plank",
      order: 0,
      sets: 2,
      target: {
        kind: "durationSeconds",
        seconds: 30,
        basis: "per_side",
      },
      restSeconds: 60,
    });
    expect(new Set(latestPlan.days[0]?.exercises.map((exercise) => exercise.exerciseId)).size).toBe(3);
    expect(planDraftSchema.safeParse(latestPlan).success).toBe(true);
  });
});
