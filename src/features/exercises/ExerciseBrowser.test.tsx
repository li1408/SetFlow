import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExerciseDefinition,
  MuscleGroupId,
} from "../../domain/planning/types";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { ExerciseBrowser } from "./ExerciseBrowser";

afterEach(cleanup);

type BrowsableExercise = ExerciseDefinition & {
  primaryMuscles: MuscleGroupId[];
  secondaryMuscles: MuscleGroupId[];
};

const exercises: BrowsableExercise[] = [
  {
    id: "strict-push-up",
    name: "标准俯卧撑",
    cue: "收紧核心，胸口整体下降后有力推起。",
    difficulty: "intermediate",
    movement: "push",
    requiredEquipment: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["arms"],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength"],
    defaultRestSeconds: 75,
  },
  {
    id: "resistance-band-row",
    name: "弹力带坐姿划船",
    cue: "肩膀下沉，肘部贴近身体向后拉。",
    difficulty: "beginner",
    movement: "pull",
    requiredEquipment: ["resistance_band"],
    primaryMuscles: ["back"],
    secondaryMuscles: ["arms"],
    measure: { kind: "reps", basis: "total" },
    goals: ["general_fitness", "strength"],
    defaultRestSeconds: 60,
  },
];

describe("ExerciseBrowser", () => {
  it("shows artwork and selectable exercises for every supported equipment", () => {
    render(
      <ExerciseBrowser
        exercises={builtInExerciseCatalog}
        onExerciseSelect={vi.fn()}
      />,
    );

    for (const label of [
      "徒手",
      "弹力带",
      "哑铃",
      "壶铃",
      "单杠",
      "训练凳",
      "瑜伽垫",
    ]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeEnabled();
      expect(
        within(button).getByRole("img", { name: `${label}器械示意图` }),
      ).toBeInTheDocument();
    }
  });

  it("selects target areas from a front and back muscle map", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseBrowser
        exercises={builtInExerciseCatalog}
        onExerciseSelect={vi.fn()}
      />,
    );

    for (const label of [
      "徒手",
      "弹力带",
      "哑铃",
      "壶铃",
      "单杠",
      "训练凳",
      "瑜伽垫",
    ]) {
      await user.click(screen.getByRole("button", { name: label }));
    }
    await user.click(screen.getByRole("button", { name: "继续" }));

    const map = screen.getByRole("region", { name: "人体肌肉选择图" });
    expect(within(map).getByText("正面")).toBeInTheDocument();
    expect(within(map).getByText("背面")).toBeInTheDocument();

    const chest = within(map).getByRole("button", { name: "选择胸部" });
    const back = within(map).getByRole("button", { name: "选择背部" });
    expect(chest).toBeEnabled();
    expect(back).toBeEnabled();

    await user.click(chest);
    expect(chest).toHaveAttribute("aria-pressed", "true");
  });

  it("moves forward and backward without losing equipment or muscle selections", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseBrowser exercises={exercises} onExerciseSelect={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "选择设备" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "徒手" }));
    await user.click(screen.getByRole("button", { name: "弹力带" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(
      screen.getByRole("heading", { name: "选择目标肌群" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "选择胸部" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(
      screen.getByRole("heading", { name: "选择动作" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getByRole("button", { name: "选择胸部" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getByRole("button", { name: "徒手" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "弹力带" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("closes an exercise preview and sends the selected exercise to the caller", async () => {
    const user = userEvent.setup();
    const onExerciseSelect = vi.fn();
    render(
      <ExerciseBrowser
        exercises={exercises}
        onExerciseSelect={onExerciseSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "徒手" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "选择胸部" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    const previewButton = screen.getByRole("button", {
      name: "查看标准俯卧撑",
    });
    await user.click(previewButton);

    expect(
      screen.getByRole("dialog", { name: "标准俯卧撑动作预览" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(previewButton).toHaveFocus();
    expect(onExerciseSelect).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "查看标准俯卧撑" }),
    );
    await user.click(
      screen.getByRole("button", { name: "添加标准俯卧撑" }),
    );

    expect(onExerciseSelect).toHaveBeenCalledTimes(1);
    expect(onExerciseSelect).toHaveBeenCalledWith(exercises[0]);
  });

  it("keeps keyboard focus inside the preview until it closes", async () => {
    const user = userEvent.setup();
    const onExerciseSelect = vi.fn();
    const { rerender } = render(
      <ExerciseBrowser
        exercises={exercises}
        onExerciseSelect={onExerciseSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "徒手" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "选择胸部" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    const previewButton = screen.getByRole("button", {
      name: "查看标准俯卧撑",
    });
    await user.click(previewButton);

    const closeButton = screen.getByRole("button", { name: "关闭预览" });
    const addButton = screen.getByRole("button", {
      name: "添加标准俯卧撑",
    });
    expect(closeButton).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    await user.tab({ shift: true });
    expect(addButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    addButton.focus();
    rerender(
      <ExerciseBrowser
        exercises={exercises}
        onExerciseSelect={onExerciseSelect}
      />,
    );
    expect(addButton).toHaveFocus();

    previewButton.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });
});
