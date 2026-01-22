// Lifecycle slot types
export const LIFECYCLE_SLOTS = [
  "account_creation",
  "activation",
  "core_usage",
  "revenue",
  "churn",
] as const;

export type LifecycleSlot = (typeof LIFECYCLE_SLOTS)[number];

// Main lifecycle slots (excludes churn - used for primary flow)
export const MAIN_LIFECYCLE_SLOTS = [
  "account_creation",
  "activation",
  "core_usage",
  "revenue",
] as const;

// Slots required for completion
export const REQUIRED_SLOTS: LifecycleSlot[] = [
  "account_creation",
  "activation",
  "core_usage",
];

// Display info for slots
export const SLOT_INFO: Record<LifecycleSlot, { name: string; required: boolean }> = {
  account_creation: { name: "Account Creation", required: true },
  activation: { name: "Activation", required: true },
  core_usage: { name: "Core Usage", required: true },
  revenue: { name: "Revenue", required: false },
  churn: { name: "Churn", required: false },
};
