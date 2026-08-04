import { afterEach, describe, expect, it } from "vitest";
import type { GeneratedPlanDraft } from "../domain/planning/types";
import { createWorkoutSession } from "../domain/workout/workout-machine";
import { SetFlowDatabase } from "./database";
import { PlanRepository } from "./plan-repository";
import { WorkoutRepository } from "./workout-repository";

const databases: SetFlowDatabase[] = [];

const draft: GeneratedPlanDraft = {
  source: { kind: "generated", ruleVersion: "1.0.0" },
  days: [
    {
      ordinal: 1,
      name: "全身训练 A",
      exercises: [
        {
          exerciseId: "bodyweight-squat",
          order: 0,
          sets: 2,
          target: { kind: "reps", min: 8, max: 12, basis: "total" },
          restSeconds: 60,
        },
      ],
    },
  ],
};

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe("PlanRepository", () => {
  it("persists one active plan and replaces it atomically", async () => {
    const name = `setflow-plans-${crypto.randomUUID()}`;
    const firstDatabase = track(new SetFlowDatabase(name));
    const firstRepository = new PlanRepository(firstDatabase, () => 1_000);
    await firstRepository.saveActive({ id: "plan-1", name: "居家基础", draft });
    await firstRepository.saveActive({
      id: "plan-2",
      name: "居家进阶",
      draft: {
        ...draft,
        days: [{ ...draft.days[0]!, name: "全身训练 B" }],
      },
    });

    firstDatabase.close();
    const reopenedDatabase = track(new SetFlowDatabase(name));
    const reopened = new PlanRepository(reopenedDatabase, () => 2_000);

    expect(await reopened.getActive()).toMatchObject({
      id: "plan-2",
      name: "居家进阶",
      draft: { days: [{ name: "全身训练 B" }] },
    });
    expect(await reopenedDatabase.plans.where("status").equals("archived").count()).toBe(1);
  });

  it("does not rewrite a workout snapshot when its source plan changes", async () => {
    const database = track(
      new SetFlowDatabase(`setflow-snapshot-${crypto.randomUUID()}`),
    );
    const plans = new PlanRepository(database, () => 1_000);
    const workouts = new WorkoutRepository(database, () => 1_000);
    await plans.saveActive({ id: "plan-1", name: "居家基础", draft });
    await workouts.create(
      createWorkoutSession("session-1", {
        planId: "plan-1",
        planName: "居家基础",
        exercises: [
          {
            id: "bodyweight-squat",
            name: "徒手深蹲",
            cue: "脚掌稳稳踩地，膝盖跟随脚尖方向下蹲。",
            sets: 2,
            target: { kind: "reps", min: 8, max: 12, basis: "total" },
            restSeconds: 60,
          },
        ],
      }),
    );

    await plans.saveActive({
      id: "plan-1",
      name: "已修改计划",
      draft: {
        ...draft,
        days: [
          {
            ...draft.days[0]!,
            exercises: [{ ...draft.days[0]!.exercises[0]!, sets: 5 }],
          },
        ],
      },
    });

    expect(await workouts.getActive()).toMatchObject({
      snapshot: {
        planName: "居家基础",
        exercises: [{ sets: 2 }],
      },
    });
  });
});

function track(database: SetFlowDatabase) {
  databases.push(database);
  return database;
}
