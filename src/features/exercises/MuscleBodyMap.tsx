import type { MuscleGroupId } from "../../domain/planning/types";

export interface MuscleMapOption {
  id: MuscleGroupId;
  label: string;
  count: number;
  selected: boolean;
  disabled: boolean;
}

interface MuscleBodyMapProps {
  options: MuscleMapOption[];
  onToggle: (id: MuscleGroupId) => void;
}

const frontGroups: MuscleGroupId[] = [
  "shoulders",
  "chest",
  "arms",
  "core",
  "legs",
];
const backGroups: MuscleGroupId[] = ["back", "glutes"];

export function MuscleBodyMap({ options, onToggle }: MuscleBodyMapProps) {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const fullBody = optionsById.get("full_body");

  return (
    <section className="muscle-map" aria-label="人体肌肉选择图">
      {fullBody ? (
        <MuscleButton
          className="muscle-map__full-body js-exercise-choice"
          option={fullBody}
          onToggle={onToggle}
        />
      ) : null}

      <div className="muscle-map__figures">
        <BodyFigure
          label="正面"
          groups={frontGroups}
          optionsById={optionsById}
          onToggle={onToggle}
        />
        <BodyFigure
          label="背面"
          groups={backGroups}
          optionsById={optionsById}
          onToggle={onToggle}
        />
      </div>

      <p className="muscle-map__hint">点击身体上的肌肉区域，可多选训练目标。</p>
    </section>
  );
}

interface BodyFigureProps {
  label: "正面" | "背面";
  groups: MuscleGroupId[];
  optionsById: Map<MuscleGroupId, MuscleMapOption>;
  onToggle: (id: MuscleGroupId) => void;
}

function BodyFigure({
  label,
  groups,
  optionsById,
  onToggle,
}: BodyFigureProps) {
  return (
    <div className="muscle-map__figure">
      <span className="muscle-map__view-label">{label}</span>
      <div className="muscle-map__canvas">
        <BodySilhouette />
        {groups.map((id) => {
          const option = optionsById.get(id);
          return option ? (
            <MuscleButton
              className={`muscle-map__hotspot muscle-map__hotspot--${id} js-exercise-choice`}
              key={id}
              option={option}
              onToggle={onToggle}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

function BodySilhouette() {
  return (
    <svg
      className="muscle-map__silhouette"
      viewBox="0 0 100 250"
      aria-hidden="true"
    >
      <circle cx="50" cy="20" r="13" />
      <path d="M31 45C36 37 42 35 50 35s14 2 19 10l9 64-13 50-4 74H39l-4-74-13-50Z" />
      <path d="M31 46 12 76 8 138M69 46l19 30 4 62M39 232l-5 14M61 232l5 14" />
    </svg>
  );
}

interface MuscleButtonProps {
  className: string;
  option: MuscleMapOption;
  onToggle: (id: MuscleGroupId) => void;
}

function MuscleButton({ className, option, onToggle }: MuscleButtonProps) {
  return (
    <button
      className={className}
      type="button"
      aria-label={`选择${option.label}`}
      aria-pressed={option.selected}
      disabled={option.disabled}
      onClick={() => onToggle(option.id)}
    >
      <span>{option.label}</span>
      <small>{option.count}</small>
    </button>
  );
}
