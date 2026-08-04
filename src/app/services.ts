import { SetFlowDatabase } from "../data/database";
import { PlanRepository } from "../data/plan-repository";
import { WorkoutRepository } from "../data/workout-repository";

export interface AppServices {
  plans: Pick<PlanRepository, "getActive" | "saveActive">;
  workouts: Pick<WorkoutRepository, "apply" | "create" | "recoverActive">;
  now: () => number;
  createId: () => string;
}

const database = new SetFlowDatabase();

export const defaultAppServices: AppServices = {
  plans: new PlanRepository(database),
  workouts: new WorkoutRepository(database),
  now: Date.now,
  createId: () => crypto.randomUUID(),
};
