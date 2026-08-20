import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { ExercisePreviewDialog } from "./ExercisePreviewDialog";

afterEach(cleanup);

describe("ExercisePreviewDialog", () => {
  it("shows an offline two-step preview for catalog exercises", async () => {
    const exercise = builtInExerciseCatalog.find(
      (item) => item.id === "bodyweight-squat",
    );
    if (!exercise) throw new Error("Squat exercise fixture is missing");

    const user = userEvent.setup();
    render(
      <ExercisePreviewDialog
        exercise={exercise}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(document.querySelectorAll(".exercise-preview__frame")).toHaveLength(2);
    expect(screen.getByText("Exercise data by RepDB (repdb.co)")).toBeInTheDocument();

    const mediaButton = screen.getByRole("button", {
      name: "暂停徒手深蹲动作演示",
    });
    await user.click(mediaButton);

    expect(
      screen.getByRole("button", { name: "播放徒手深蹲动作演示" }),
    ).toBeInTheDocument();
  });

  it("shows an exact still preview without adding a playback control", () => {
    const exercise = builtInExerciseCatalog.find(
      (item) => item.id === "single-leg-glute-bridge",
    );
    if (!exercise) throw new Error("Glute bridge exercise fixture is missing");

    render(
      <ExercisePreviewDialog
        exercise={exercise}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "单腿臀桥 · 顶端姿势" }),
    ).toHaveAttribute("src", "/media/exercises/single-leg-glute-bridge.jpg");
    expect(
      screen.queryByRole("button", { name: /单腿臀桥动作演示/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the pull-up sample as a muted looping offline video", () => {
    const exercise = builtInExerciseCatalog.find(
      (item) => item.id === "overhand-pull-up",
    );
    if (!exercise) throw new Error("Pull-up exercise fixture is missing");

    render(
      <ExercisePreviewDialog
        exercise={exercise}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const video = document.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Pull-up preview video was not rendered");
    }
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("controls");
    expect(video).toHaveProperty("muted", true);

    const source = video.querySelector("source");
    expect(source).toHaveAttribute(
      "src",
      "/media/exercises/overhand-pull-up.webm",
    );
    expect(source).toHaveAttribute("type", "video/webm");
    expect(
      screen.getByRole("button", { name: "暂停正握引体向上动作演示" }),
    ).toBeInTheDocument();
  });

  it("pauses and resumes the sample from the single media control", async () => {
    const exercise = builtInExerciseCatalog.find(
      (item) => item.id === "overhand-pull-up",
    );
    if (!exercise) throw new Error("Pull-up exercise fixture is missing");

    const user = userEvent.setup();
    render(
      <ExercisePreviewDialog
        exercise={exercise}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const video = document.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Pull-up preview video was not rendered");
    }

    let paused = false;
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {
      paused = true;
      video.dispatchEvent(new Event("pause"));
    });
    const play = vi.spyOn(video, "play").mockImplementation(() => {
      paused = false;
      video.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });

    await user.click(
      screen.getByRole("button", { name: "暂停正握引体向上动作演示" }),
    );
    expect(pause).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "播放正握引体向上动作演示" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "播放正握引体向上动作演示" }),
    );
    expect(play).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "暂停正握引体向上动作演示" }),
    ).toBeInTheDocument();
  });
});
