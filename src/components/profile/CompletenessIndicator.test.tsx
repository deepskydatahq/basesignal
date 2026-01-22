import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompletenessIndicator } from "./CompletenessIndicator";

const ALL_SECTIONS = [
  { id: "core_identity", label: "Core Identity", isComplete: false },
  { id: "journey_map", label: "User Journey Map", isComplete: false },
  { id: "first_value", label: "First Value Moment", isComplete: false },
  { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
  { id: "measurement_plan", label: "Measurement Plan", isComplete: false },
  { id: "heartbeat", label: "Heartbeat Event", isComplete: false },
  { id: "activation", label: "Activation Definition", isComplete: false },
  { id: "active", label: "Active Definition", isComplete: false },
  { id: "at_risk", label: "At-Risk Signals", isComplete: false },
  { id: "churn", label: "Churn Definition", isComplete: false },
  { id: "expansion", label: "Expansion Triggers", isComplete: false },
];

function setup(sections = ALL_SECTIONS) {
  const user = userEvent.setup();
  render(<CompletenessIndicator sections={sections} />);
  return { user };
}

test("renders collapsed state with progress bar and count", () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 4, // 4 complete
  }));
  setup(sections);

  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  expect(screen.getByText("4 of 11")).toBeInTheDocument();
});
