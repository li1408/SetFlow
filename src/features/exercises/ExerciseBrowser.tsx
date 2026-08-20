import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  filterExercises,
  type BrowsableExercise,
  type ExerciseEquipmentFilter,
} from "../../domain/exercises/exercise-filter";
import { EquipmentArtwork } from "./EquipmentArtwork";
import { ExercisePreviewDialog } from "./ExercisePreviewDialog";
import { MuscleBodyMap } from "./MuscleBodyMap";
import {
  NESTED_PREDICTIVE_BACK_EVENT,
  isPredictiveBackEvent,
} from "../../native/predictive-back";
import {
  difficultyLabels,
  equipmentChoices,
  equipmentLabels,
} from "./exercise-browser-options";
import {
  mapOriginalMusclesToExerciseGroups,
  originalMuscleChoices,
  originalMuscleLabels,
  type OriginalMuscleId,
} from "./original-muscle-options";

gsap.registerPlugin(useGSAP);

type BrowserStep = "equipment" | "muscles" | "exercises";

export interface ExerciseBrowserProps {
  exercises: readonly BrowsableExercise[];
  selectedExerciseIds?: readonly string[];
  onExerciseSelect: (exercise: BrowsableExercise) => void;
  onBackRequestChange?: (handler: (() => boolean) | null) => void;
  onBackAvailabilityChange?: (available: boolean) => void;
}

export function ExerciseBrowser({
  exercises,
  selectedExerciseIds = [],
  onExerciseSelect,
  onBackRequestChange,
  onBackAvailabilityChange,
}: ExerciseBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const edgeGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const [step, setStep] = useState<BrowserStep>("equipment");
  const [equipment, setEquipment] = useState<ExerciseEquipmentFilter[]>([]);
  const [muscles, setMuscles] = useState<OriginalMuscleId[]>([]);
  const [preview, setPreview] = useState<BrowsableExercise | null>(null);
  const [backGestureProgress, setBackGestureProgress] = useState(0);
  const [previewBackGestureProgress, setPreviewBackGestureProgress] =
    useState(0);

  const exerciseMuscleGroups = useMemo(
    () => mapOriginalMusclesToExerciseGroups(muscles),
    [muscles],
  );
  const equipmentCompatible = useMemo(
    () => filterExercises(exercises, { equipment, muscles: [] }),
    [equipment, exercises],
  );
  const visibleExercises = useMemo(
    () =>
      filterExercises(exercises, {
        equipment,
        muscles: exerciseMuscleGroups,
      }),
    [equipment, exerciseMuscleGroups, exercises],
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".js-exercise-step",
          { autoAlpha: 0, x: 12 },
          { autoAlpha: 1, x: 0, duration: 0.28, ease: "power2.out" },
        );
        gsap.fromTo(
          ".js-exercise-choice",
          { autoAlpha: 0, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.24,
            ease: "power1.out",
            stagger: 0.035,
          },
        );
      });
      return () => media.revert();
    },
    { scope: rootRef, dependencies: [step], revertOnUpdate: true },
  );

  function toggleEquipment(id: ExerciseEquipmentFilter) {
    setEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleMuscle(id: OriginalMuscleId) {
    setMuscles((current) => {
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  }

  const handleBackRequest = useCallback(() => {
    if (preview) {
      setPreview(null);
      return true;
    }
    if (step === "exercises") {
      setStep("muscles");
      return true;
    }
    if (step === "muscles") {
      setStep("equipment");
      return true;
    }
    return false;
  }, [preview, step]);

  useEffect(() => {
    onBackRequestChange?.(handleBackRequest);
    return () => onBackRequestChange?.(null);
  }, [handleBackRequest, onBackRequestChange]);

  useEffect(() => {
    onBackAvailabilityChange?.(step !== "equipment" || preview !== null);
    return () => onBackAvailabilityChange?.(false);
  }, [onBackAvailabilityChange, preview, step]);

  const previousStep = getPreviousStep(step);

  useEffect(() => {
    function handleNativePredictiveBack(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isPredictiveBackEvent(detail)) return;

      if (preview) {
        if (detail.type === "started" || detail.type === "progress") {
          setPreviewBackGestureProgress(detail.progress);
        } else {
          setPreviewBackGestureProgress(0);
        }
        return;
      }

      if (detail.type === "started" || detail.type === "progress") {
        setBackGestureProgress(detail.progress);
        return;
      }

      setBackGestureProgress(0);
    }

    window.addEventListener(
      NESTED_PREDICTIVE_BACK_EVENT,
      handleNativePredictiveBack,
    );
    return () =>
      window.removeEventListener(
        NESTED_PREDICTIVE_BACK_EVENT,
        handleNativePredictiveBack,
      );
  }, [preview]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.pointerType === "mouse" || event.clientX > 24 || !previousStep || preview) {
      return;
    }
    edgeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const gesture = edgeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = Math.max(0, event.clientX - gesture.startX);
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.active && Math.abs(deltaY) > deltaX) {
      edgeGestureRef.current = null;
      return;
    }
    if (!gesture.active && deltaX < 8) return;

    gesture.active = true;
    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setBackGestureProgress(Math.min(1, deltaX / (window.innerWidth * 0.32)));
  }

  function finishEdgeGesture(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const gesture = edgeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    edgeGestureRef.current = null;
    const shouldGoBack = gesture.active && backGestureProgress >= 0.35;
    setBackGestureProgress(0);
    if (shouldGoBack && previousStep) setStep(previousStep);
  }

  return (
    <div
      className="exercise-browser"
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishEdgeGesture}
      onPointerCancel={finishEdgeGesture}
    >
      {backGestureProgress > 0 && previousStep ? (
        <ExerciseStepPreview
          equipment={equipment}
          equipmentCompatible={equipmentCompatible}
          exercises={exercises}
          muscles={muscles}
          step={previousStep}
        />
      ) : null}
      <div
        className={`exercise-browser__current${
          backGestureProgress > 0
            ? " exercise-browser__current--dragging"
            : ""
        }`}
        style={
          backGestureProgress > 0
            ? {
                transform: `translateX(${Math.round(backGestureProgress * 100)}%)`,
              }
            : undefined
        }
      >
      <ol className="exercise-browser__stepper" aria-label="动作选择进度">
        <StepIndicator current={step} id="equipment" number="01" label="设备" />
        <StepIndicator current={step} id="muscles" number="02" label="肌群" />
        <StepIndicator current={step} id="exercises" number="03" label="动作" />
      </ol>

      {step === "equipment" ? (
        <section className="exercise-browser__step js-exercise-step" aria-labelledby="equipment-step-title">
          <header className="exercise-browser__heading">
            <p>第一步 · 可多选</p>
            <h3 id="equipment-step-title">选择设备</h3>
            <span>只展示你现在能完成的动作。</span>
          </header>
          <div className="exercise-browser__choice-grid">
            {equipmentChoices.map((choice) => {
              const count = exercises.filter((exercise) =>
                choice.id === "bodyweight"
                  ? exercise.requiredEquipment.length === 0
                  : exercise.requiredEquipment.includes(choice.id),
              ).length;
              const selected = equipment.includes(choice.id);
              return (
                <button
                  className="exercise-browser__choice js-exercise-choice"
                  type="button"
                  key={choice.id}
                  aria-label={choice.label}
                  aria-pressed={selected}
                  disabled={count === 0}
                  onClick={() => toggleEquipment(choice.id)}
                >
                  <EquipmentArtwork
                    equipment={choice.id}
                    label={choice.label}
                  />
                  <span className="exercise-browser__choice-copy">
                    <strong>{choice.label}</strong>
                    <small>{count === 0 ? "后续加入" : choice.description}</small>
                  </span>
                  <span className="exercise-browser__choice-state" aria-hidden="true">
                    {selected ? <Check size={14} /> : count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === "muscles" ? (
        <section className="exercise-browser__step js-exercise-step" aria-labelledby="muscle-step-title">
          <header className="exercise-browser__heading">
            <p>第二步 · 可多选</p>
            <h3 id="muscle-step-title">选择目标肌群</h3>
            <span>根据已选设备，聚焦今天想练的位置。</span>
          </header>
          <MuscleBodyMap
            options={originalMuscleChoices.map((choice) => {
              const count = filterExercises(equipmentCompatible, {
                equipment,
                muscles: [...choice.exerciseGroups],
              }).length;
              const selected = muscles.includes(choice.id);
              return {
                id: choice.id,
                label: choice.label,
                count,
                selected,
                disabled: count === 0,
              };
            })}
            onToggle={toggleMuscle}
          />
        </section>
      ) : null}

      {step === "exercises" ? (
        <section className="exercise-browser__step js-exercise-step" aria-labelledby="exercise-step-title">
          <header className="exercise-browser__heading">
            <p>第三步 · {visibleExercises.length} 个匹配</p>
            <h3 id="exercise-step-title">选择动作</h3>
            <span>{muscles.map((item) => originalMuscleLabels[item]).join("、")}</span>
          </header>
          <div className="exercise-browser__exercise-list">
            {visibleExercises.map((exercise, index) => {
              const selected = selectedExerciseIds.includes(exercise.id);
              const equipmentLabel =
                exercise.requiredEquipment.length === 0
                  ? "徒手"
                  : exercise.requiredEquipment.map((item) => equipmentLabels[item]).join("、");
              return (
                <button
                  className="exercise-browser__exercise js-exercise-choice"
                  type="button"
                  key={exercise.id}
                  aria-label={`查看${exercise.name}`}
                  onClick={() => setPreview(exercise)}
                >
                  <span className="exercise-browser__exercise-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="exercise-browser__exercise-copy">
                    <strong>{exercise.name}</strong>
                    <small>{difficultyLabels[exercise.difficulty]} · {equipmentLabel}</small>
                  </span>
                  <span className="exercise-browser__exercise-action">
                    {selected ? "已加入" : "预览"}
                    <ArrowRight aria-hidden="true" size={15} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <nav className="exercise-browser__navigation" aria-label="动作选择步骤">
        {step !== "equipment" ? (
          <button
            className="exercise-browser__back"
            type="button"
            onClick={handleBackRequest}
          >
            <ArrowLeft aria-hidden="true" size={17} />
            上一步
          </button>
        ) : <span />}
        {step !== "exercises" ? (
          <button
            className="exercise-browser__continue"
            type="button"
            disabled={step === "equipment" ? equipment.length === 0 : muscles.length === 0}
            onClick={() => setStep(step === "equipment" ? "muscles" : "exercises")}
          >
            继续
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        ) : null}
      </nav>

      {preview ? (
        <ExercisePreviewDialog
          exercise={preview}
          backGestureProgress={previewBackGestureProgress}
          isSelected={selectedExerciseIds.includes(preview.id)}
          onClose={() => {
            setPreviewBackGestureProgress(0);
            setPreview(null);
          }}
          onAdd={() => {
            onExerciseSelect(preview);
            setPreview(null);
          }}
        />
      ) : null}
      </div>
    </div>
  );
}

function ExerciseStepPreview({
  step,
  exercises,
  equipment,
  muscles,
  equipmentCompatible,
}: {
  step: Exclude<BrowserStep, "exercises">;
  exercises: readonly BrowsableExercise[];
  equipment: ExerciseEquipmentFilter[];
  muscles: OriginalMuscleId[];
  equipmentCompatible: readonly BrowsableExercise[];
}) {
  return (
    <div className="exercise-browser__back-preview" aria-hidden="true" inert>
      {step === "equipment" ? (
        <>
          <header className="exercise-browser__heading">
            <p>第一步 · 可多选</p>
            <h3>选择设备</h3>
            <span>只展示你现在能完成的动作。</span>
          </header>
          <div className="exercise-browser__choice-grid">
            {equipmentChoices.map((choice) => {
              const count = exercises.filter((exercise) =>
                choice.id === "bodyweight"
                  ? exercise.requiredEquipment.length === 0
                  : exercise.requiredEquipment.includes(choice.id),
              ).length;
              return (
                <div className="exercise-browser__choice" key={choice.id}>
                  <EquipmentArtwork equipment={choice.id} label={choice.label} />
                  <span className="exercise-browser__choice-copy">
                    <strong>{choice.label}</strong>
                    <small>{count === 0 ? "后续加入" : choice.description}</small>
                  </span>
                  <span className="exercise-browser__choice-state">
                    {equipment.includes(choice.id) ? <Check size={14} /> : count}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <header className="exercise-browser__heading">
            <p>第二步 · 可多选</p>
            <h3>选择目标肌群</h3>
            <span>根据已选设备，聚焦今天想练的位置。</span>
          </header>
          <MuscleBodyMap
            options={originalMuscleChoices.map((choice) => ({
              id: choice.id,
              label: choice.label,
              count: filterExercises(equipmentCompatible, {
                equipment,
                muscles: [...choice.exerciseGroups],
              }).length,
              selected: muscles.includes(choice.id),
              disabled: false,
            }))}
            onToggle={() => undefined}
          />
        </>
      )}
    </div>
  );
}

interface StepIndicatorProps {
  current: BrowserStep;
  id: BrowserStep;
  number: string;
  label: string;
}

function StepIndicator({ current, id, number, label }: StepIndicatorProps) {
  const order: BrowserStep[] = ["equipment", "muscles", "exercises"];
  const currentIndex = order.indexOf(current);
  const itemIndex = order.indexOf(id);
  const status = itemIndex === currentIndex ? "current" : itemIndex < currentIndex ? "done" : "upcoming";
  return (
    <li data-status={status} aria-current={status === "current" ? "step" : undefined}>
      <span>{number}</span>
      <strong>{label}</strong>
    </li>
  );
}

function getPreviousStep(step: BrowserStep): Exclude<BrowserStep, "exercises"> | null {
  if (step === "exercises") return "muscles";
  if (step === "muscles") return "equipment";
  return null;
}
