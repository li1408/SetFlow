import { describe, expect, it } from "vitest";
import type { StoredReminderJob } from "../data/types";
import type {
  ReminderAdapter,
  ReminderOperationResult,
  ReminderPermissionState,
  ReminderScheduleRequest,
} from "./reminder-adapter";
import {
  ReminderCoordinator,
  type ReminderJobRepository,
} from "./reminder-coordinator";

describe("ReminderCoordinator", () => {
  it("applies cancellations before schedules and acknowledges each success", async () => {
    const calls: string[] = [];
    const schedule = reminderJob({
      id: "rest-1:1:schedule",
      action: "schedule",
      notificationId: 101,
      endsAt: 75_000,
      revision: 1,
    });
    const cancel = reminderJob({
      id: "rest-1:0:cancel",
      action: "cancel",
      notificationId: 100,
      endsAt: null,
      revision: 0,
    });
    const repository = fakeRepository([schedule, cancel], calls);
    const adapter = new FakeReminderAdapter(calls);

    const result = await new ReminderCoordinator(repository, adapter).flush();

    expect(calls).toEqual([
      "cancel:100",
      "ack:rest-1:0:cancel",
      "schedule:101:75000",
      "ack:rest-1:1:schedule",
    ]);
    expect(result).toEqual({
      appliedJobIds: ["rest-1:0:cancel", "rest-1:1:schedule"],
      staleJobIds: [],
      unsupportedJobIds: [],
      compensatedNotificationIds: [],
      failures: [],
    });
  });

  it("cancels a notification immediately when a stale schedule requests compensation", async () => {
    const calls: string[] = [];
    const staleSchedule = reminderJob({
      id: "rest-1:0:schedule",
      action: "schedule",
      notificationId: 100,
      endsAt: 60_000,
      revision: 0,
    });
    const repository: ReminderJobRepository = {
      requeueActiveRestReminder: async () => undefined,
      listReminderJobs: async () => [staleSchedule],
      markReminderApplied: async ({ jobId }) => {
        calls.push(`ack:${jobId}`);
        return {
          applied: false,
          compensateCancelNotificationId: 100,
        };
      },
    };
    const adapter = new FakeReminderAdapter(calls);

    const result = await new ReminderCoordinator(repository, adapter).flush();

    expect(calls).toEqual([
      "schedule:100:60000",
      "ack:rest-1:0:schedule",
      "cancel:100",
    ]);
    expect(result.staleJobIds).toEqual(["rest-1:0:schedule"]);
    expect(result.compensatedNotificationIds).toEqual([100]);
    expect(result.appliedJobIds).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("does not acknowledge a job when the native operation fails", async () => {
    const calls: string[] = [];
    const schedule = reminderJob({
      id: "rest-2:0:schedule",
      action: "schedule",
      notificationId: 200,
      endsAt: 90_000,
      revision: 0,
    });
    const repository = fakeRepository([schedule], calls);
    const adapter = new FakeReminderAdapter(calls, {
      failScheduleIds: new Set([200]),
    });

    const result = await new ReminderCoordinator(repository, adapter).flush();

    expect(calls).toEqual(["schedule:200:90000"]);
    expect(result.appliedJobIds).toEqual([]);
    expect(result.failures).toEqual([
      { jobId: "rest-2:0:schedule", stage: "apply" },
    ]);
  });

  it("serializes overlapping flushes so a stale acknowledgement cannot cancel a live reminder", async () => {
    const calls: string[] = [];
    const schedule = reminderJob({
      id: "rest-3:0:schedule",
      action: "schedule",
      notificationId: 300,
      endsAt: 120_000,
      revision: 0,
    });
    const repository = fakeRepository([schedule], calls);
    const coordinator = new ReminderCoordinator(
      repository,
      new FakeReminderAdapter(calls),
    );

    const [first, second] = await Promise.all([
      coordinator.flush(),
      coordinator.flush(),
    ]);

    expect(calls).toEqual([
      "schedule:300:120000",
      "ack:rest-3:0:schedule",
    ]);
    expect(first.appliedJobIds).toEqual(["rest-3:0:schedule"]);
    expect(second.appliedJobIds).toEqual([]);
    expect(second.failures).toEqual([]);
  });

  it("runs a queued follow-up flush for jobs added during an active flush", async () => {
    const calls: string[] = [];
    const lateSchedule = reminderJob({
      id: "rest-4:0:schedule",
      action: "schedule",
      notificationId: 400,
      endsAt: 150_000,
      revision: 0,
    });
    let jobs: StoredReminderJob[] = [];
    let releaseFirstList: () => void = () => undefined;
    let firstListStarted: () => void = () => undefined;
    const listStarted = new Promise<void>((resolve) => {
      firstListStarted = resolve;
    });
    const firstListRelease = new Promise<void>((resolve) => {
      releaseFirstList = resolve;
    });
    let listCount = 0;
    const repository: ReminderJobRepository = {
      requeueActiveRestReminder: async () => undefined,
      listReminderJobs: async () => {
        listCount += 1;
        if (listCount === 1) {
          const snapshot = [...jobs];
          firstListStarted();
          await firstListRelease;
          return snapshot;
        }
        return [...jobs];
      },
      markReminderApplied: async ({ jobId }) => {
        jobs = jobs.filter((job) => job.id !== jobId);
        calls.push(`ack:${jobId}`);
        return { applied: true };
      },
    };
    const coordinator = new ReminderCoordinator(
      repository,
      new FakeReminderAdapter(calls),
    );

    const first = coordinator.flush();
    await listStarted;
    jobs = [lateSchedule];
    const second = coordinator.flush();
    releaseFirstList();
    await Promise.all([first, second]);

    expect(listCount).toBe(2);
    expect(calls).toEqual([
      "schedule:400:150000",
      "ack:rest-4:0:schedule",
    ]);
  });
});

class FakeReminderAdapter implements ReminderAdapter {
  constructor(
    private readonly calls: string[],
    private readonly options: { failScheduleIds?: Set<number> } = {},
  ) {}

  async checkPermission(): Promise<ReminderPermissionState> {
    return "granted";
  }

  async requestPermission(): Promise<ReminderPermissionState> {
    return "granted";
  }

  async checkExactAlarmSetting(): Promise<ReminderPermissionState> {
    return "granted";
  }

  async openExactAlarmSetting(): Promise<ReminderPermissionState> {
    return "granted";
  }

  async schedule(
    request: ReminderScheduleRequest,
  ): Promise<ReminderOperationResult> {
    this.calls.push(
      `schedule:${request.notificationId}:${request.at.getTime()}`,
    );
    if (this.options.failScheduleIds?.has(request.notificationId)) {
      throw new Error("schedule failed");
    }
    return { status: "applied" };
  }

  async cancel(notificationId: number): Promise<ReminderOperationResult> {
    this.calls.push(`cancel:${notificationId}`);
    return { status: "applied" };
  }
}

function fakeRepository(
  jobs: StoredReminderJob[],
  calls: string[],
): ReminderJobRepository {
  const acknowledgedJobIds = new Set<string>();
  return {
    requeueActiveRestReminder: async () => undefined,
    listReminderJobs: async () =>
      jobs.filter((job) => !acknowledgedJobIds.has(job.id)),
    markReminderApplied: async ({ jobId }) => {
      acknowledgedJobIds.add(jobId);
      calls.push(`ack:${jobId}`);
      return { applied: true };
    },
  };
}

function reminderJob(
  overrides: Partial<StoredReminderJob> &
    Pick<
      StoredReminderJob,
      "id" | "action" | "notificationId" | "endsAt" | "revision"
    >,
): StoredReminderJob {
  return {
    timerId: "rest-1",
    workoutId: "workout-1",
    status: "pending",
    createdAt: 1_000,
    updatedAt: 1_000,
    schemaVersion: 1,
    ...overrides,
  };
}
