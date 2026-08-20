export interface ExercisePreviewCredit {
  label: string;
  sourceUrl: string;
  license: string;
  licenseUrl?: string;
}

export interface ExercisePreviewFrame {
  src: string;
  label: string;
}

export interface ExercisePreviewSequence {
  kind: "sequence";
  frames: readonly ExercisePreviewFrame[];
  credit: ExercisePreviewCredit;
  note?: string;
  intervalMs?: number;
}

export interface ExercisePreviewAnimatedImage {
  kind: "animated-image";
  src: string;
  alt: string;
  credit: ExercisePreviewCredit;
  note?: string;
}

export interface ExercisePreviewVideo {
  kind: "video";
  src: string;
  type: string;
  poster: string;
  credit: ExercisePreviewCredit;
  note?: string;
}

export type ExercisePreviewMedia =
  | ExercisePreviewSequence
  | ExercisePreviewAnimatedImage
  | ExercisePreviewVideo;

const repDbCredit: ExercisePreviewCredit = {
  label: "Exercise data by RepDB (repdb.co)",
  sourceUrl: "https://repdb.co",
  license: "RepDB Free Tier License v1.0",
};

const repDbSequence = (
  assetId: string,
  labels: readonly [string, string],
  options: Pick<ExercisePreviewSequence, "note" | "intervalMs"> = {},
): ExercisePreviewSequence => ({
  kind: "sequence",
  frames: [
    {
      src: `/media/exercises/repdb/${assetId}-start.webp`,
      label: labels[0],
    },
    {
      src: `/media/exercises/repdb/${assetId}-peak.webp`,
      label: labels[1],
    },
  ],
  credit: repDbCredit,
  ...options,
});

const repDbStill = (
  assetId: string,
  label: string,
  note?: string,
): ExercisePreviewSequence => ({
  kind: "sequence",
  frames: [
    {
      src: `/media/exercises/repdb/${assetId}-main.webp`,
      label,
    },
  ],
  credit: repDbCredit,
  note,
});

export const exercisePreviewMediaById: Readonly<
  Record<string, ExercisePreviewMedia>
> = {
  "bodyweight-squat": repDbSequence("bodyweight-squat", ["站稳", "下蹲"]),
  "squat-pulse": repDbSequence(
    "bodyweight-squat",
    ["进入深蹲", "底部位置"],
    {
      intervalMs: 950,
      note: "动作在深蹲底部小幅完成；画面用于确认下蹲路径。",
    },
  ),
  "hip-hinge-reach": repDbSequence(
    "bodyweight-good-morning",
    ["站稳", "髋部后移"],
  ),
  "single-leg-glute-bridge": {
    kind: "sequence",
    frames: [
      {
        src: "/media/exercises/single-leg-glute-bridge.jpg",
        label: "顶端姿势",
      },
    ],
    credit: {
      label: "Klewis425 · Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Single_Leg_Bridge.jpg",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
    note: "支撑脚踩稳，另一侧膝盖保持抬起。",
  },
  "wall-push-up": {
    kind: "animated-image",
    src: "/media/exercises/wall-push-up.gif",
    alt: "墙面俯卧撑循环示范",
    credit: {
      label: "CDC · Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Wallpushup-CDC_strength_training_for_older_adults.gif",
      license: "Public domain",
    },
  },
  "kneeling-push-up": repDbSequence("knee-push-ups", ["撑稳", "胸口下沉"]),
  "strict-push-up": repDbSequence("push-up", ["撑稳", "胸口下沉"]),
  "low-bar-inverted-row": repDbSequence("inverted-row", ["手臂伸直", "胸口拉近"]),
  "resistance-band-row": {
    kind: "sequence",
    frames: [
      {
        src: "/media/exercises/resistance-band-row.jpg",
        label: "完整动作",
      },
    ],
    credit: {
      label: "Strenght and Health Science · Flickr",
      sourceUrl: "https://www.flickr.com/photos/146248579@N06/32827016027",
      license: "CC BY-NC-ND 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-nd/2.0/",
    },
    note: "弹力带绕脚固定，先伸直手臂，再贴近身体向后拉。",
  },
  "overhand-pull-up": {
    kind: "video",
    src: "/media/exercises/overhand-pull-up.webm",
    type: "video/webm",
    poster: "/media/exercises/overhand-pull-up-poster.jpg",
    credit: {
      label: "FitnessScape · Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Pull-ups_-_exercise_demonstration_video.webm",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    },
  },
  "alternating-reverse-lunge": repDbSequence(
    "lunge",
    ["前后站稳", "垂直下沉"],
    { note: "后撤时先稳住脚步，再沿画面轨迹垂直下沉。" },
  ),
  "stationary-split-squat": repDbSequence(
    "lunge",
    ["前后站稳", "垂直下沉"],
  ),
  "dead-bug-reach": repDbSequence("dead-bug", ["核心收紧", "对侧伸展"]),
  "forearm-plank": repDbStill("plank", "保持姿势", "头、背、髋尽量保持一条直线。"),
  "side-plank": repDbStill("side-plank", "保持姿势", "肩、髋与脚踝尽量保持一条直线。"),
  "dumbbell-goblet-squat": {
    kind: "sequence",
    frames: [
      {
        src: "/media/exercises/dumbbell-goblet-squat.jpg",
        label: "完整动作",
      },
    ],
    credit: {
      label: "philip · wger",
      sourceUrl: "https://wger.de/en/exercise/203/view/dumbbell-goblet-squat",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    note: "双手托住哑铃上端，保持重量靠近胸口。",
  },
  "kettlebell-deadlift": repDbSequence(
    "kettlebell-deadlift",
    ["髋部后移", "站直锁定"],
  ),
  "bench-incline-push-up": repDbSequence(
    "incline-push-ups",
    ["撑稳凳面", "胸口靠近"],
  ),
  "mat-bird-dog": repDbStill(
    "bird-dog-hold",
    "对侧伸展",
    "收紧核心，伸出的手脚与躯干保持稳定。",
  ),
};
