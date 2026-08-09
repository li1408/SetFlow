import type { ExerciseEquipmentFilter } from "../../domain/exercises/exercise-filter";

interface EquipmentArtworkProps {
  equipment: ExerciseEquipmentFilter;
  label: string;
}

export function EquipmentArtwork({
  equipment,
  label,
}: EquipmentArtworkProps) {
  return (
    <svg
      className="equipment-artwork"
      viewBox="0 0 120 84"
      role="img"
      aria-label={`${label}器械示意图`}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      >
        <EquipmentShape equipment={equipment} />
      </g>
    </svg>
  );
}

function EquipmentShape({
  equipment,
}: Pick<EquipmentArtworkProps, "equipment">) {
  if (equipment === "bodyweight") {
    return (
      <>
        <circle cx="60" cy="16" r="9" />
        <path d="M60 27v24M39 38l21-9 21 9M60 51 45 72M60 51l15 21" />
      </>
    );
  }

  if (equipment === "resistance_band") {
    return (
      <>
        <path d="M28 64c-13-14-11-36 3-45 10-7 23-1 29 12 6-13 19-19 29-12 14 9 16 31 3 45-11 12-24 5-32-10-8 15-21 22-32 10Z" />
        <path d="M41 59c7-7 13-17 19-28 6 11 12 21 19 28" opacity=".45" />
      </>
    );
  }

  if (equipment === "dumbbell") {
    return (
      <>
        <path d="M35 42h50" />
        <path d="M27 28v28M35 23v38M85 23v38M93 28v28" />
      </>
    );
  }

  if (equipment === "kettlebell") {
    return (
      <>
        <path d="M43 32c0-15 7-22 17-22s17 7 17 22" />
        <path d="M35 51c0-14 11-23 25-23s25 9 25 23c0 16-10 25-25 25S35 67 35 51Z" />
        <path d="M49 53h22" opacity=".45" />
      </>
    );
  }

  if (equipment === "pull_up_bar") {
    return (
      <>
        <path d="M20 73V14h80v59M20 22h80" />
        <circle cx="60" cy="38" r="7" />
        <path d="M60 45v17M43 29l17 10 17-10M60 62l-10 11M60 62l10 11" />
      </>
    );
  }

  if (equipment === "bench") {
    return (
      <>
        <path d="M24 38h72v14H24zM34 52l-8 22M86 52l8 22" />
        <path d="M26 74h12M82 74h12" opacity=".45" />
      </>
    );
  }

  return (
    <>
      <path d="M25 30h63c8 0 12 6 12 13v22H37c-8 0-12-6-12-13Z" />
      <path d="M37 65V42h63M88 30c-8 0-12 5-12 12s4 12 12 12 12-5 12-12-4-12-12-12Z" />
    </>
  );
}
