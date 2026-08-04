import { z } from "zod";
import { generatedPlanDraftSchema } from "../domain/planning/schemas";
import type { GeneratedPlanDraft } from "../domain/planning/types";
import type { SetFlowDatabase } from "./database";
import {
  DATABASE_SCHEMA_VERSION,
  type StoredPlan,
} from "./types";

export interface SaveActivePlanInput {
  id: string;
  name: string;
  draft: GeneratedPlanDraft;
}

const saveActivePlanInputSchema = z.strictObject({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(80),
  draft: generatedPlanDraftSchema,
});

export class PlanRepository {
  constructor(
    private readonly database: SetFlowDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async saveActive(input: SaveActivePlanInput): Promise<StoredPlan> {
    const validated = saveActivePlanInputSchema.parse(input);
    const draft = validated.draft as GeneratedPlanDraft;

    return this.database.transaction("rw", this.database.plans, async () => {
      const active = await this.database.plans
        .where("activeSlot")
        .equals("active")
        .first();
      const existing = await this.database.plans.get(validated.id);
      const now = this.now();

      if (active && active.id !== validated.id) {
        const archived: StoredPlan = { ...active, status: "archived", updatedAt: now };
        delete archived.activeSlot;
        await this.database.plans.put(archived);
      }

      const plan: StoredPlan = {
        id: validated.id,
        name: validated.name,
        draft,
        status: "active",
        activeSlot: "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: DATABASE_SCHEMA_VERSION,
      };
      await this.database.plans.put(plan);
      return plan;
    });
  }

  async getActive(): Promise<StoredPlan | null> {
    const record = await this.database.plans
      .where("activeSlot")
      .equals("active")
      .first();
    if (!record) return null;

    return {
      ...record,
      draft: generatedPlanDraftSchema.parse(record.draft) as GeneratedPlanDraft,
    };
  }
}
