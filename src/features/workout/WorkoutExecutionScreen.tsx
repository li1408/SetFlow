import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type {
  WorkoutEvent,
  WorkoutSession,
  WorkoutTransition,
} from "../../domain/workout/types";
import {
  ActiveSetStage,
  CompletedStage,
  InvalidStage,
  NextSetReadyStage,
  RestingStage,
} from "./workout-stages";
import "./workout-execution.css";

gsap.registerPlugin(useGSAP);

const MAX_AUTOMATIC_ELAPSED_RETRIES = 3;

export interface WorkoutExecutionScreenProps {
  session: WorkoutSession;
  onEvent: (
    event: WorkoutEvent,
  ) => Promise<WorkoutTransition> | WorkoutTransition;
  onFinish?: () => void;
}

export function WorkoutExecutionScreen({
  session,
  onEvent,
  onFinish,
}: WorkoutExecutionScreenProps) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(false);
  const elapsedTimersRef = useRef(new Set<string>());
  const restFeedbackTimeoutRef = useRef<number | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [showRestEndedFeedback, setShowRestEndedFeedback] = useState(false);
  const [elapsedRetryState, setElapsedRetryState] = useState<{
    timerKey: string;
    count: number;
    failed: boolean;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const viewKey = getViewKey(session);
  const restTimer = session.phase.kind === "resting" ? session.phase.timer : null;
  const restTimerId = restTimer?.id;
  const restTimerRevision = restTimer?.revision;
  const restTimerEndsAt = restTimer?.endsAt;
  const currentRestTimerKey = restTimer
    ? `${restTimer.id}:${restTimer.revision}`
    : null;
  const elapsedRetryCount =
    elapsedRetryState?.timerKey === currentRestTimerKey
      ? elapsedRetryState.count
      : 0;
  const hasElapsedPersistenceFailure =
    currentRestTimerKey !== null &&
    elapsedRetryState?.timerKey === currentRestTimerKey &&
    elapsedRetryState.failed;

  const dispatch = useCallback(
    async (event: WorkoutEvent, successMessage: string) => {
      if (pendingRef.current) return false;

      pendingRef.current = true;
      setIsPending(true);
      setAnnouncement("正在保存…");

      try {
        const transition = await onEvent(event);
        if (transition.kind === "rejected") {
          setAnnouncement("当前训练状态已变化，请重试。");
        } else if (transition.kind === "noop") {
          setAnnouncement("训练状态已是最新。");
        } else {
          setAnnouncement(successMessage);
          if (
            event.type === "rest_elapsed" &&
            transition.facts.some((fact) => fact.type === "REST_FINISHED")
          ) {
            if (restFeedbackTimeoutRef.current !== undefined) {
              window.clearTimeout(restFeedbackTimeoutRef.current);
            }
            setShowRestEndedFeedback(true);
            restFeedbackTimeoutRef.current = window.setTimeout(() => {
              setShowRestEndedFeedback(false);
              restFeedbackTimeoutRef.current = undefined;
            }, 1_450);
          }
        }
        return true;
      } catch {
        setAnnouncement("操作失败，请重试。");
        return false;
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [onEvent],
  );

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [viewKey]);

  useEffect(
    () => () => {
      if (restFeedbackTimeoutRef.current !== undefined) {
        window.clearTimeout(restFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (!restTimerId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setNow(Date.now());
    });
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [restTimerEndsAt, restTimerId, restTimerRevision]);

  const remainingMilliseconds =
    session.phase.kind === "resting"
      ? Math.max(0, session.phase.timer.endsAt - now)
      : 0;

  useEffect(() => {
    if (
      session.phase.kind !== "resting" ||
      remainingMilliseconds > 0
    ) {
      return;
    }

    const timerKey = `${session.phase.timer.id}:${session.phase.timer.revision}`;
    if (hasElapsedPersistenceFailure) return;
    if (elapsedTimersRef.current.has(timerKey)) return;
    elapsedTimersRef.current.add(timerKey);

    let cancelled = false;
    let retryTimeoutId: number | undefined;
    void dispatch(
      {
        type: "rest_elapsed",
        timerId: session.phase.timer.id,
        expectedRevision: session.phase.timer.revision,
        at: Date.now(),
      },
      "休息结束，下一组已准备。",
    ).then((wasHandled) => {
      if (wasHandled || cancelled) return;
      elapsedTimersRef.current.delete(timerKey);
      if (elapsedRetryCount >= MAX_AUTOMATIC_ELAPSED_RETRIES) {
        setElapsedRetryState({
          timerKey,
          count: elapsedRetryCount,
          failed: true,
        });
        setAnnouncement("休息已结束，但训练进度尚未保存。");
        return;
      }
      const retryDelay = 1_000 * 2 ** elapsedRetryCount;
      retryTimeoutId = window.setTimeout(
        () =>
          setElapsedRetryState({
            timerKey,
            count: elapsedRetryCount + 1,
            failed: false,
          }),
        retryDelay,
      );
    });

    return () => {
      cancelled = true;
      if (retryTimeoutId !== undefined) window.clearTimeout(retryTimeoutId);
    };
  }, [
    dispatch,
    elapsedRetryCount,
    hasElapsedPersistenceFailure,
    remainingMilliseconds,
    session.phase,
  ]);

  function retryElapsedPersistence() {
    if (!currentRestTimerKey || isPending) return;
    elapsedTimersRef.current.delete(currentRestTimerKey);
    setElapsedRetryState({
      timerKey: currentRestTimerKey,
      count: 0,
      failed: false,
    });
    setAnnouncement("正在重试保存训练进度…");
  }

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          stage,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.34,
            ease: "power2.out",
            clearProps: "transform,opacity,visibility",
          },
        );
      });
      return () => media.revert();
    },
    {
      scope: rootRef,
      dependencies: [viewKey],
      revertOnUpdate: true,
    },
  );

  const stage = useMemo(() => {
    if (session.phase.kind === "active_set") {
      const position = session.phase.position;
      const exercise = session.snapshot.exercises[position.exerciseIndex];
      if (!exercise) return <InvalidStage headingRef={headingRef} />;

      return (
        <ActiveSetStage
          key={viewKey}
          exercise={exercise}
          headingRef={headingRef}
          isPending={isPending}
          position={position}
          onComplete={(actual) =>
            dispatch(
              {
                type: "complete_set",
                expectedPosition: position,
                performedSetId: createId("set"),
                restTimerId: createId("rest"),
                at: Date.now(),
                actual,
              },
              "本组已保存，开始休息。",
            )
          }
        />
      );
    }

    if (session.phase.kind === "resting") {
      const nextExercise =
        session.snapshot.exercises[session.phase.nextPosition.exerciseIndex];
      if (!nextExercise) return <InvalidStage headingRef={headingRef} />;

      const dispatchTimerEvent = (event: "adjust-down" | "adjust-up" | "skip") => {
        const shared = {
          timerId: session.phase.kind === "resting" ? session.phase.timer.id : "",
          expectedRevision:
            session.phase.kind === "resting" ? session.phase.timer.revision : -1,
          at: Date.now(),
        };

        if (event === "skip") {
          return dispatch(
            { type: "skip_rest", ...shared },
            "已跳过休息，下一组已准备。",
          );
        }

        return dispatch(
          {
            type: "adjust_rest",
            ...shared,
            deltaSeconds: event === "adjust-down" ? -15 : 15,
          },
          event === "adjust-down"
            ? "休息时间已减少 15 秒。"
            : "休息时间已增加 15 秒。",
        );
      };

      return (
        <RestingStage
          headingRef={headingRef}
          isPending={isPending}
          nextExercise={nextExercise}
          nextPosition={session.phase.nextPosition}
          remainingMilliseconds={remainingMilliseconds}
          onAdjustDown={() => dispatchTimerEvent("adjust-down")}
          onAdjustUp={() => dispatchTimerEvent("adjust-up")}
          onSkip={() => dispatchTimerEvent("skip")}
        />
      );
    }

    if (session.phase.kind === "next_set_ready") {
      const position = session.phase.position;
      const exercise = session.snapshot.exercises[position.exerciseIndex];
      if (!exercise) return <InvalidStage headingRef={headingRef} />;

      return (
        <NextSetReadyStage
          exercise={exercise}
          headingRef={headingRef}
          isPending={isPending}
          position={position}
          onActivate={() =>
            dispatch(
              {
                type: "activate_next_set",
                expectedPosition: position,
              },
              "下一组已开始。",
            )
          }
        />
      );
    }

    if (session.phase.kind === "completed") {
      return (
        <CompletedStage
          headingRef={headingRef}
          session={session}
          onFinish={onFinish}
        />
      );
    }

    return <InvalidStage headingRef={headingRef} isIdle />;
  }, [dispatch, isPending, onFinish, remainingMilliseconds, session, viewKey]);

  return (
    <section
      ref={rootRef}
      className="workout-execution"
      aria-labelledby="workout-stage-title"
      aria-busy={isPending}
    >
      {showRestEndedFeedback ? (
        <div
          className="workout-rest-ended-feedback"
          data-testid="rest-ended-feedback"
          aria-hidden="true"
        >
          <span>倒计时完成</span>
          <strong>休息结束</strong>
          <small>准备下一组</small>
        </div>
      ) : null}
      <p className="workout-live-region" role="status" aria-atomic="true">
        {announcement}
      </p>
      {hasElapsedPersistenceFailure ? (
        <div className="workout-persistence-alert" role="alert">
          <div>
            <strong>休息已经结束，但训练进度暂时无法保存</strong>
            <p>请保留此页面并重试；本次训练不会被自动跳过。</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={retryElapsedPersistence}
          >
            重试保存
          </button>
        </div>
      ) : null}
      <div ref={stageRef} className="workout-stage">
        {stage}
      </div>
    </section>
  );
}

function getViewKey(session: WorkoutSession): string {
  const { phase } = session;
  if (phase.kind === "active_set" || phase.kind === "next_set_ready") {
    return `${phase.kind}:${phase.position.exerciseIndex}:${phase.position.setIndex}`;
  }
  if (phase.kind === "resting") {
    return `${phase.kind}:${phase.timer.id}:${phase.timer.revision}`;
  }
  return phase.kind;
}

function createId(prefix: "set" | "rest"): string {
  const cryptoApi: Pick<Crypto, "getRandomValues"> & {
    randomUUID?: () => string;
  } = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === "function") {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }

  const random = new Uint32Array(4);
  cryptoApi.getRandomValues(random);
  return `${prefix}-${Array.from(random, (value) => value.toString(16)).join("")}`;
}
