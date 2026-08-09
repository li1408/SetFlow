import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExerciseDefinition,
  MuscleGroupId,
} from "../../domain/planning/types";
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
    await user.click(screen.getByRole("button", { name: "胸部" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(
      screen.getByRole("heading", { name: "选择动作" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getByRole("button", { name: "胸部" })).toHaveAttribute(
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
    await user.click(screen.getByRole("button", { name: "胸部" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(
      screen.getByRole("button", { name: "查看标准俯卧撑" }),
    );

    expect(
      screen.getByRole("dialog", { name: "标准俯卧撑动作预览" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
});
