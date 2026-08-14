import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pause, Play, X } from "lucide-react";
import type { BrowsableExercise } from "../../domain/exercises/exercise-filter";
import {
  difficultyLabels,
  equipmentLabels,
  muscleLabels,
} from "./exercise-browser-options";
import "./exercise-browser.css";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const closeFromEffect = useEffectEvent(onClose);

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
  const hasPullUpSample = exercise.id === "overhand-pull-up";

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => setIsVideoPlaying(false));
    } else {
      video.pause();
    }
  };

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

        {hasPullUpSample ? (
          <button
            className="exercise-preview__media exercise-preview__media--video"
            type="button"
            aria-label={`${isVideoPlaying ? "暂停" : "播放"}${exercise.name}动作演示`}
            onClick={toggleVideoPlayback}
          >
            <video
              ref={videoRef}
              aria-hidden="true"
              autoPlay
              loop
              muted
              playsInline
              poster="/media/exercises/overhand-pull-up-poster.jpg"
              preload="auto"
              onPause={() => setIsVideoPlaying(false)}
              onPlay={() => setIsVideoPlaying(true)}
            >
              <source
                src="/media/exercises/overhand-pull-up.webm"
                type="video/webm"
              />
            </video>
            <span className="exercise-preview__media-status">
              离线 · 自动循环
            </span>
            <span className="exercise-preview__media-control" aria-hidden="true">
              {isVideoPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              {isVideoPlaying ? "暂停" : "继续"}
            </span>
          </button>
        ) : (
          <div className="exercise-preview__media" aria-label="动作视频占位">
            <span className="exercise-preview__media-code" aria-hidden="true">
              {exercise.movement.toUpperCase()}
            </span>
            <span className="exercise-preview__play" aria-hidden="true">
              <Play size={24} fill="currentColor" />
            </span>
            <p>离线动作示范</p>
            <small>视频素材将在下一增量接入</small>
          </div>
        )}

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
