import type { StoredReminderJob } from "../data/types";
import type { WorkoutRepository } from "../data/workout-repository";
import type {
  ReminderAdapter,
  ReminderOperationResult,
  ReminderScheduleRequest,
} from "./reminder-adapter";

export type ReminderJobRepository = Pick<
  WorkoutRepository,
  "listReminderJobs" | "markReminderApplied"
>;

export interface ReminderSyncFailure {
  jobId: string;
  stage: "apply" | "ack" | "compensate";
}

export interface ReminderSyncResult {
  appliedJobIds: string[];
  staleJobIds: string[];
  unsupportedJobIds: string[];
  compensatedNotificationIds: number[];
  failures: ReminderSyncFailure[];
}

export class ReminderCoordinator {
  constructor(
    private readonly repository: ReminderJobRepository,
    private readonly adapter: ReminderAdapter,
  ) {}

  async flush(): Promise<ReminderSyncResult> {
    const result = emptyResult();
    const jobs = prioritizeCancellations(
      await this.repository.listReminderJobs(),
    );

    for (const job of jobs) {
      let operation: ReminderOperationResult;
      try {
        operation = await this.apply(job);
      } catch {
        result.failures.push({ jobId: job.id, stage: "apply" });
        continue;
      }

      if (operation.status === "unsupported") {
        result.unsupportedJobIds.push(job.id);
        continue;
      }

      let acknowledgement: Awaited<
        ReturnType<ReminderJobRepository["markReminderApplied"]>
      >;
      try {
        acknowledgement = await this.repository.markReminderApplied({
          jobId: job.id,
        });
      } catch {
        result.failures.push({ jobId: job.id, stage: "ack" });
        continue;
      }

      if (acknowledgement.applied) {
        result.appliedJobIds.push(job.id);
        continue;
      }

      result.staleJobIds.push(job.id);
      if (acknowledgement.compensateCancelNotificationId === undefined) {
        continue;
      }

      try {
        const compensation = await this.adapter.cancel(
          acknowledgement.compensateCancelNotificationId,
        );
        if (compensation.status === "applied") {
          result.compensatedNotificationIds.push(
            acknowledgement.compensateCancelNotificationId,
          );
        } else {
          result.failures.push({ jobId: job.id, stage: "compensate" });
        }
      } catch {
        result.failures.push({ jobId: job.id, stage: "compensate" });
      }
    }

    return result;
  }

  private apply(job: StoredReminderJob): Promise<ReminderOperationResult> {
    if (job.action === "cancel") {
      return this.adapter.cancel(job.notificationId);
    }
    if (job.endsAt === null) {
      return Promise.reject(new Error("A schedule reminder requires endsAt"));
    }

    const request: ReminderScheduleRequest = {
      notificationId: job.notificationId,
      at: new Date(job.endsAt),
      title: "休息结束",
      body: "准备开始下一组",
      timerId: job.timerId,
      workoutId: job.workoutId,
      revision: job.revision,
    };
    return this.adapter.schedule(request);
  }
}

function emptyResult(): ReminderSyncResult {
  return {
    appliedJobIds: [],
    staleJobIds: [],
    unsupportedJobIds: [],
    compensatedNotificationIds: [],
    failures: [],
  };
}

function prioritizeCancellations(
  jobs: StoredReminderJob[],
): StoredReminderJob[] {
  return jobs
    .map((job, index) => ({ job, index }))
    .sort(
      (left, right) =>
        reminderActionRank(left.job.action) -
          reminderActionRank(right.job.action) || left.index - right.index,
    )
    .map(({ job }) => job);
}

function reminderActionRank(action: StoredReminderJob["action"]): number {
  return action === "cancel" ? 0 : 1;
}
