import type { ICPProfile, ActivationMap, MeasurementSpec } from "./types";

export function isICPProfile(value: unknown): value is ICPProfile {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    Array.isArray(v.value_moment_priorities) &&
    Array.isArray(v.activation_triggers)
  );
}

export function isActivationMap(value: unknown): value is ActivationMap {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.stages) &&
    typeof v.primary_activation_level === "number"
  );
}

export function isMeasurementSpec(value: unknown): value is MeasurementSpec {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.events) &&
    typeof v.total_events === "number"
  );
}
