import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInExerciseCatalog } from "../../domain/exercises/built-in-catalog";
import { ExercisePreviewDialog } from "./ExercisePreviewDialog";

afterEach(cleanup);

describe("ExercisePreviewDialog", () => {
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
