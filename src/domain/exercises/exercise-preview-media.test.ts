/// <reference types="node" />

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { builtInExerciseCatalog } from "./built-in-catalog";
import { exercisePreviewMediaById } from "./exercise-preview-media";

describe("exercisePreviewMediaById", () => {
  it("provides a local preview for every built-in exercise", () => {
    expect(Object.keys(exercisePreviewMediaById).sort()).toEqual(
      builtInExerciseCatalog.map((exercise) => exercise.id).sort(),
    );
  });

  it("only references bundled media files that exist", () => {
    const mediaPaths = Object.values(exercisePreviewMediaById).flatMap((media) => {
      if (media.kind === "video") return [media.src, media.poster];
      if (media.kind === "animated-image") return [media.src];
      return media.frames.map((frame) => frame.src);
    });

    for (const mediaPath of mediaPaths) {
      expect(mediaPath).toMatch(/^\/media\/exercises\//);
      expect(existsSync(resolve("public", mediaPath.slice(1)))).toBe(true);
    }
  });

  it("keeps source and license details with every preview", () => {
    for (const media of Object.values(exercisePreviewMediaById)) {
      expect(media.credit.label).not.toHaveLength(0);
      expect(media.credit.sourceUrl).toMatch(/^https:\/\//);
      expect(media.credit.license).not.toHaveLength(0);
    }
  });
});
