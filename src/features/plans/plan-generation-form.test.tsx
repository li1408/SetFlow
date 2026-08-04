import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanGenerationForm } from "./plan-generation-form";

afterEach(cleanup);

describe("PlanGenerationForm", () => {
  it("starts with an accessible bodyweight-first setup", () => {
    render(<PlanGenerationForm onPlanGenerated={vi.fn()} />);

    expect(
      screen.getByRole("form", { name: "离线规则生成计划" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("训练目标")).toHaveValue("general_fitness");
    expect(screen.getByLabelText("每周训练天数")).toHaveValue(3);
    expect(screen.getByLabelText("经验水平")).toHaveValue("beginner");
    expect(screen.getByLabelText("单次训练时长（分钟）")).toHaveValue(30);
    screen
      .getAllByRole("checkbox")
      .forEach((checkbox) => expect(checkbox).not.toBeChecked());
    expect(
      screen.getByRole("button", { name: "生成离线计划" }),
    ).toHaveClass("plan-generation-form__submit");
  });

  it("generates a readable preview and returns the draft to its caller", async () => {
    const user = userEvent.setup();
    const onPlanGenerated = vi.fn();
    render(<PlanGenerationForm onPlanGenerated={onPlanGenerated} />);

    await user.click(screen.getByRole("button", { name: "生成离线计划" }));

    expect(onPlanGenerated).toHaveBeenCalledTimes(1);
    expect(onPlanGenerated.mock.calls[0]?.[0].days).toHaveLength(3);
    expect(
      screen.getByRole("heading", { name: "计划预览" }),
    ).toBeInTheDocument();
    expect(screen.getByText("全身训练 A")).toBeInTheDocument();
    expect(screen.getAllByText(/徒手深蹲/).length).toBeGreaterThan(0);
    expect(screen.getByText(/规则版本 1\.0\.0/)).toBeInTheDocument();
  });

  it("wires goal, days, experience, equipment and duration into generation", async () => {
    const user = userEvent.setup();
    const onPlanGenerated = vi.fn();
    render(<PlanGenerationForm onPlanGenerated={onPlanGenerated} />);

    await user.selectOptions(screen.getByLabelText("训练目标"), "strength");
    await user.clear(screen.getByLabelText("每周训练天数"));
    await user.type(screen.getByLabelText("每周训练天数"), "4");
    await user.selectOptions(screen.getByLabelText("经验水平"), "intermediate");
    await user.click(screen.getByLabelText("单杠"));
    await user.clear(screen.getByLabelText("单次训练时长（分钟）"));
    await user.type(screen.getByLabelText("单次训练时长（分钟）"), "45");
    await user.click(screen.getByRole("button", { name: "生成离线计划" }));

    expect(screen.getByLabelText("单杠")).toBeChecked();
    expect(onPlanGenerated).toHaveBeenCalledTimes(1);
    expect(onPlanGenerated.mock.calls[0]?.[0].days).toHaveLength(4);
  });

  it("shows a visible error and does not call back for invalid input", () => {
    const onPlanGenerated = vi.fn();
    render(<PlanGenerationForm onPlanGenerated={onPlanGenerated} />);

    fireEvent.change(screen.getByLabelText("每周训练天数"), {
      target: { value: "1" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "离线规则生成计划" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("请检查输入");
    expect(onPlanGenerated).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "计划预览" }),
    ).not.toBeInTheDocument();
  });
});
