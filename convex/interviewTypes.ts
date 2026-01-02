// Interview type definitions and constants

export const INTERVIEW_TYPES = {
  overview: {
    id: "overview",
    name: "Overview Journey",
    description: "Map your product's key lifecycle moments from signup to churn",
    dependencies: [] as string[],
    outputs: { stages: true, rules: [] },
    isSetupInterview: true, // Flag to distinguish from detailed interviews
  },
  first_value: {
    id: "first_value",
    name: "Find First Value",
    description: "Identify the activation moment - when users first experience value",
    dependencies: [] as string[],
    outputs: { stages: true, rules: ["activation"] },
  },
  retention: {
    id: "retention",
    name: "Define Retention",
    description: "Define what 'coming back' looks like for your product",
    dependencies: ["first_value"],
    outputs: { stages: false, rules: ["active"] },
  },
  value_outcomes: {
    id: "value_outcomes",
    name: "Define Value Outcomes",
    description: "Map the behaviors that create value",
    dependencies: ["first_value"],
    outputs: { stages: true, rules: ["value"] },
  },
  value_capture: {
    id: "value_capture",
    name: "Value Capture",
    description: "Link behaviors to revenue and business metrics",
    dependencies: ["value_outcomes"],
    outputs: { stages: false, rules: ["revenue"] },
  },
  churn: {
    id: "churn",
    name: "Churn",
    description: "Define inactivity and cancellation signals",
    dependencies: ["first_value", "value_outcomes"],
    outputs: { stages: true, rules: ["at_risk", "churn"] },
  },
} as const;

export type InterviewType = keyof typeof INTERVIEW_TYPES;
export type InterviewTypeConfig = (typeof INTERVIEW_TYPES)[InterviewType];

// Order for display (respects typical progression)
export const INTERVIEW_TYPE_ORDER: InterviewType[] = [
  "first_value",
  "retention",
  "value_outcomes",
  "value_capture",
  "churn",
];

export type InterviewStatus = "locked" | "available" | "in_progress" | "complete";

export function getInterviewTypeConfig(type: InterviewType): InterviewTypeConfig {
  return INTERVIEW_TYPES[type];
}
