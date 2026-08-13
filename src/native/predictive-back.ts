export const PREDICTIVE_BACK_EVENT = "setflowPredictiveBack";
export const NESTED_PREDICTIVE_BACK_EVENT = "setflowNestedPredictiveBack";

export type PredictiveBackEvent =
  | { type: "started"; progress: number }
  | { type: "progress"; progress: number }
  | { type: "cancelled"; progress: 0 }
  | { type: "invoked"; progress: 1 };

export function isPredictiveBackEvent(
  value: unknown,
): value is PredictiveBackEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as { type?: unknown; progress?: unknown };
  return (
    (event.type === "started" ||
      event.type === "progress" ||
      event.type === "cancelled" ||
      event.type === "invoked") &&
    typeof event.progress === "number"
  );
}
