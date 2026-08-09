import type {
  EquipmentId,
  ExperienceLevel,
  MuscleGroupId,
} from "../../domain/planning/types";
import type { ExerciseEquipmentFilter } from "../../domain/exercises/exercise-filter";

export interface EquipmentChoice {
  id: ExerciseEquipmentFilter;
  label: string;
  mark: string;
  description: string;
}

export interface MuscleChoice {
  id: MuscleGroupId;
  label: string;
  mark: string;
}

export const equipmentChoices: EquipmentChoice[] = [
  {
    id: "bodyweight",
    label: "徒手",
    mark: "BW",
    description: "无需额外器械",
  },
  {
    id: "resistance_band",
    label: "弹力带",
    mark: "RB",
    description: "轻便阻力训练",
  },
  {
    id: "dumbbell",
    label: "哑铃",
    mark: "DB",
    description: "自由重量训练",
  },
  {
    id: "kettlebell",
    label: "壶铃",
    mark: "KB",
    description: "摆动与力量训练",
  },
  {
    id: "pull_up_bar",
    label: "单杠",
    mark: "PB",
    description: "悬垂与拉力训练",
  },
  {
    id: "bench",
    label: "训练凳",
    mark: "BN",
    description: "支撑与卧推动作",
  },
  {
    id: "mat",
    label: "瑜伽垫",
    mark: "MT",
    description: "地面动作更舒适",
  },
];

export const muscleChoices: MuscleChoice[] = [
  { id: "full_body", label: "全身", mark: "ALL" },
  { id: "chest", label: "胸部", mark: "CH" },
  { id: "back", label: "背部", mark: "BK" },
  { id: "legs", label: "腿部", mark: "LG" },
  { id: "glutes", label: "臀部", mark: "GL" },
  { id: "core", label: "核心", mark: "CR" },
  { id: "shoulders", label: "肩部", mark: "SH" },
  { id: "arms", label: "手臂", mark: "AR" },
];

export const equipmentLabels: Record<EquipmentId, string> = {
  mat: "瑜伽垫",
  resistance_band: "弹力带",
  dumbbell: "哑铃",
  kettlebell: "壶铃",
  pull_up_bar: "单杠",
  bench: "训练凳",
};

export const muscleLabels: Record<MuscleGroupId, string> = {
  full_body: "全身",
  chest: "胸部",
  back: "背部",
  legs: "腿部",
  glutes: "臀部",
  core: "核心",
  shoulders: "肩部",
  arms: "手臂",
};

export const difficultyLabels: Record<ExperienceLevel, string> = {
  beginner: "入门",
  intermediate: "基础",
  advanced: "进阶",
};
