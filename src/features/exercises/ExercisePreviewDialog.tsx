import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Check, Pause, Play, X } from "lucide-react";
import type { BrowsableExercise } from "../../domain/exercises/exercise-filter";
import {
  exercisePreviewMediaById,
  type ExercisePreviewMedia,
} from "../../domain/exercises/exercise-preview-media";
import {
  difficultyLabels,
  equipmentLabels,
  muscleLabels,
} from "./exercise-browser-options";
import "./exercise-browser.css";

gsap.registerPlugin(useGSAP);

export interface ExercisePreviewDialogProps {
  exercise: BrowsableExercise;
  backGestureProgress?: number;
  isSelected?: boolean;
  onAdd: () => void;
  onClose: () => void;
}

export function ExercisePreviewDialog({
  exercise,
  backGestureProgress = 0,
  isSelected = false,
  onAdd,
  onClose,
}: ExercisePreviewDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeFromEffect = useEffectEvent(onClose);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          dialogRef.current,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" },
        );
      });
      return () => media.revert();
    },
    { scope: dialogRef },
  );

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusCloseButton = () => closeButtonRef.current?.focus();
    focusCloseButton();
    const focusFrame = window.requestAnimationFrame(focusCloseButton);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFromEffect();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const equipment =
    exercise.requiredEquipment.length === 0
      ? "徒手"
      : exercise.requiredEquipment.map((item) => equipmentLabels[item]).join("、");

  const clampedProgress = Math.min(1, Math.max(0, backGestureProgress));
  const previewMedia = exercisePreviewMediaById[exercise.id];
  if (!previewMedia) {
    throw new Error(`Missing preview media for exercise: ${exercise.id}`);
  }

  return createPortal(
    <div
      className="exercise-preview-backdrop"
      style={
        clampedProgress > 0
          ? {
              backgroundColor: `rgb(0 0 0 / ${0.72 * (1 - clampedProgress)})`,
            }
          : undefined
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="exercise-preview js-exercise-preview"
        style={
          clampedProgress > 0
            ? { transform: `translateX(${Math.round(clampedProgress * 100)}%)` }
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label={`${exercise.name}动作预览`}
      >
        <header className="exercise-preview__header">
          <div>
            <p>动作预览</p>
            <h3>{exercise.name}</h3>
          </div>
          <button
            ref={closeButtonRef}
            className="exercise-preview__close"
            type="button"
            aria-label="关闭预览"
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <PreviewMedia exerciseName={exercise.name} media={previewMedia} />

        <div className="exercise-preview__badges" aria-label="动作属性">
          <span>{difficultyLabels[exercise.difficulty]}</span>
          <span>{equipment}</span>
          {exercise.primaryMuscles.map((muscle) => (
            <span key={muscle}>{muscleLabels[muscle]}</span>
          ))}
        </div>

        <section className="exercise-preview__guidance" aria-labelledby="exercise-guidance-title">
          <p>动作要点</p>
          <h4 id="exercise-guidance-title">先看清，再开始这一组</h4>
          <div>
            <Check aria-hidden="true" size={18} />
            <span>{exercise.cue}</span>
          </div>
        </section>

        <button
          className="exercise-preview__add"
          type="button"
          aria-label={`添加${exercise.name}`}
          disabled={isSelected}
          onClick={onAdd}
        >
          {isSelected ? "已在计划中" : "添加到训练"}
        </button>
      </section>
    </div>
    ,
    document.body,
  );
}

function PreviewMedia({
  exerciseName,
  media,
}: {
  exerciseName: string;
  media: ExercisePreviewMedia;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const togglePlayback = () => {
    if (media.kind === "video") {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        void video.play().catch(() => setIsPlaying(false));
      } else {
        video.pause();
      }
      return;
    }

    if (media.kind === "sequence" && media.frames.length > 1) {
      setIsPlaying((playing) => !playing);
    }
  };

  let mediaContent;
  if (media.kind === "video") {
    mediaContent = (
      <button
        className="exercise-preview__media exercise-preview__media--video"
        type="button"
        aria-label={`${isPlaying ? "暂停" : "播放"}${exerciseName}动作演示`}
        onClick={togglePlayback}
      >
        <video
          ref={videoRef}
          aria-hidden="true"
          autoPlay
          loop
          muted
          playsInline
          poster={media.poster}
          preload="auto"
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        >
          <source src={media.src} type={media.type} />
        </video>
        <MediaStatus label="离线 · 自动循环" />
        <MediaControl isPlaying={isPlaying} />
      </button>
    );
  } else if (media.kind === "animated-image") {
    mediaContent = (
      <div className="exercise-preview__media exercise-preview__media--art">
        <img src={media.src} alt={media.alt} />
        <MediaStatus label="离线 · 循环示范" />
      </div>
    );
  } else {
    const hasMultipleFrames = media.frames.length > 1;
    const sequenceStyle = {
      "--exercise-frame-interval": `${media.intervalMs ?? 1400}ms`,
    } as CSSProperties;
    const frames = (
      <div
        className={`exercise-preview__frames${
          hasMultipleFrames ? " has-multiple" : ""
        }${isPlaying ? "" : " is-paused"}`}
        style={sequenceStyle}
      >
        {media.frames.map((frame, index) => (
          <img
            className="exercise-preview__frame"
            src={frame.src}
            alt={hasMultipleFrames ? "" : `${exerciseName} · ${frame.label}`}
            aria-hidden={hasMultipleFrames ? "true" : undefined}
            key={frame.src}
            style={{ "--exercise-frame-index": index } as CSSProperties}
          />
        ))}
      </div>
    );
    const phaseLabel = media.frames.map((frame) => frame.label).join(" ↔ ");

    mediaContent = hasMultipleFrames ? (
      <button
        className="exercise-preview__media exercise-preview__media--art"
        type="button"
        aria-label={`${isPlaying ? "暂停" : "播放"}${exerciseName}动作演示`}
        onClick={togglePlayback}
      >
        {frames}
        <MediaStatus label="离线 · 2 步循环" />
        <span className="exercise-preview__phase" aria-hidden="true">
          {phaseLabel}
        </span>
        <MediaControl isPlaying={isPlaying} />
      </button>
    ) : (
      <div className="exercise-preview__media exercise-preview__media--art">
        {frames}
        <MediaStatus label="离线 · 姿势参考" />
        <span className="exercise-preview__phase">{phaseLabel}</span>
      </div>
    );
  }

  return (
    <div className="exercise-preview__media-block">
      {mediaContent}
      {media.note ? <p className="exercise-preview__media-note">{media.note}</p> : null}
      <p className="exercise-preview__credit">
        <a href={media.credit.sourceUrl} target="_blank" rel="noreferrer">
          {media.credit.label}
        </a>
        <span> · {media.credit.license}</span>
      </p>
    </div>
  );
}

function MediaStatus({ label }: { label: string }) {
  return <span className="exercise-preview__media-status">{label}</span>;
}

function MediaControl({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span className="exercise-preview__media-control" aria-hidden="true">
      {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
      {isPlaying ? "暂停" : "继续"}
    </span>
  );
}
