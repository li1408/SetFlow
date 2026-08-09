import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  filterExercises,
  type BrowsableExercise,
  type ExerciseEquipmentFilter,
} from "../../domain/exercises/exercise-filter";
import type { MuscleGroupId } from "../../domain/planning/types";
import { EquipmentArtwork } from "./EquipmentArtwork";
import { ExercisePreviewDialog } from "./ExercisePreviewDialog";
import {
  difficultyLabels,
  equipmentChoices,
  equipmentLabels,
  muscleChoices,
  muscleLabels,
} from "./exercise-browser-options";

gsap.registerPlugin(useGSAP);

type BrowserStep = "equipment" | "muscles" | "exercises";

export interface ExerciseBrowserProps {
  exercises: readonly BrowsableExercise[];
  selectedExerciseIds?: readonly string[];
  onExerciseSelect: (exercise: BrowsableExercise) => void;
}

export function ExerciseBrowser({
  exercises,
  selectedExerciseIds = [],
  onExerciseSelect,
}: ExerciseBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<BrowserStep>("equipment");
  const [equipment, setEquipment] = useState<ExerciseEquipmentFilter[]>([]);
  const [muscles, setMuscles] = useState<MuscleGroupId[]>([]);
  const [preview, setPreview] = useState<BrowsableExercise | null>(null);

  const equipmentCompatible = useMemo(
    () => filterExercises(exercises, { equipment, muscles: [] }),
    [equipment, exercises],
  );
  const visibleExercises = useMemo(
    () => filterExercises(exercises, { equipment, muscles }),
    [equipment, exercises, muscles],
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

  useGSAP(
    () => {
      if (!preview) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".js-exercise-preview",
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" },
        );
      });
      return () => media.revert();
    },
    {
      scope: rootRef,
      dependencies: [preview?.id],
      revertOnUpdate: true,
    },
  );

  function toggleEquipment(id: ExerciseEquipmentFilter) {
    setEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleMuscle(id: MuscleGroupId) {
    setMuscles((current) => {
      if (id === "full_body") {
        return current.includes(id) ? [] : [id];
      }
      const withoutFullBody = current.filter((item) => item !== "full_body");
      return withoutFullBody.includes(id)
        ? withoutFullBody.filter((item) => item !== id)
        : [...withoutFullBody, id];
    });
  }

  return (
    <div className="exercise-browser" ref={rootRef}>
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
          <div className="exercise-browser__muscle-grid">
            {muscleChoices.map((choice) => {
              const count =
                choice.id === "full_body"
                  ? equipmentCompatible.length
                  : filterExercises(equipmentCompatible, {
                      equipment,
                      muscles: [choice.id],
                    }).length;
              const selected = muscles.includes(choice.id);
              return (
                <button
                  className="exercise-browser__muscle js-exercise-choice"
                  type="button"
                  key={choice.id}
                  aria-label={choice.label}
                  aria-pressed={selected}
                  disabled={count === 0}
                  onClick={() => toggleMuscle(choice.id)}
                >
                  <span aria-hidden="true">{choice.mark}</span>
                  <strong>{choice.label}</strong>
                  <small>{count} 个动作</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === "exercises" ? (
        <section className="exercise-browser__step js-exercise-step" aria-labelledby="exercise-step-title">
          <header className="exercise-browser__heading">
            <p>第三步 · {visibleExercises.length} 个匹配</p>
            <h3 id="exercise-step-title">选择动作</h3>
            <span>{muscles.map((item) => muscleLabels[item]).join("、")}</span>
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
            onClick={() => setStep(step === "exercises" ? "muscles" : "equipment")}
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
          isSelected={selectedExerciseIds.includes(preview.id)}
          onClose={() => setPreview(null)}
          onAdd={() => {
            onExerciseSelect(preview);
            setPreview(null);
          }}
        />
      ) : null}
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
