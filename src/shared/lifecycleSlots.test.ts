// src/shared/lifecycleSlots.test.ts

import { expect, test } from "vitest";
import { LIFECYCLE_SLOTS, MAIN_LIFECYCLE_SLOTS } from "./lifecycleSlots";

test("MAIN_LIFECYCLE_SLOTS excludes churn", () => {
  expect(MAIN_LIFECYCLE_SLOTS).toEqual([
    "account_creation",
    "activation",
    "core_usage",
    "revenue",
  ]);
  expect(MAIN_LIFECYCLE_SLOTS).not.toContain("churn");
});

test("LIFECYCLE_SLOTS includes all 5 slots", () => {
  expect(LIFECYCLE_SLOTS).toHaveLength(5);
  expect(LIFECYCLE_SLOTS).toContain("churn");
});
