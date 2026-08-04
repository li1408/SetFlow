import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export interface WorkoutExecutionScreenProps {
  session: WorkoutSession;
  onEvent: (
    event: WorkoutEvent,
  ) => Promise<WorkoutTransition> | WorkoutTransition;
}

export function WorkoutExecutionScreen({
  session,
  onEvent,
}: WorkoutExecutionScreenProps) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(false);
  const elapsedTimersRef = useRef(new Set<string>());
  const [isPending, setIsPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const viewKey = getViewKey(session);
  const restTimer = session.phase.kind === "resting" ? session.phase.timer : null;
  const restTimerId = restTimer?.id;
  const restTimerRevision = restTimer?.revision;
  const restTimerEndsAt = restTimer?.endsAt;

  const dispatch = useCallback(
    async (event: WorkoutEvent, successMessage: string) => {
      if (pendingRef.current) return;

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
        }
      } catch {
        setAnnouncement("操作失败，请重试。");
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

  useEffect(() => {
    if (!restTimerId) return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
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
    if (elapsedTimersRef.current.has(timerKey)) return;
    elapsedTimersRef.current.add(timerKey);

    void dispatch(
      {
        type: "rest_elapsed",
        timerId: session.phase.timer.id,
        expectedRevision: session.phase.timer.revision,
        at: Date.now(),
      },
      "休息结束，下一组已准备。",
    );
  }, [dispatch, remainingMilliseconds, session.phase]);

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
      return <CompletedStage headingRef={headingRef} session={session} />;
    }

    return <InvalidStage headingRef={headingRef} isIdle />;
  }, [dispatch, isPending, remainingMilliseconds, session, viewKey]);

  return (
    <section
      ref={rootRef}
      className="workout-execution"
      aria-labelledby="workout-stage-title"
      aria-busy={isPending}
    >
      <p className="workout-live-region" role="status" aria-atomic="true">
        {announcement}
      </p>
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
