// Journey types that match interview types
export const JOURNEY_TYPES = [
  "overview",
  "first_value",
  "retention",
  "value_outcomes",
  "value_capture",
  "churn",
] as const;

export type JourneyType = (typeof JOURNEY_TYPES)[number];
