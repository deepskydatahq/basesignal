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

test('shows "Getting Started" status for 0-3 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 3, // 3 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
});

test('shows "Taking Shape" status for 4-6 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 5, // 5 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('shows "Well Defined" status for 7-9 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 8, // 8 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('shows "Complete" status for 10-11 sections', async () => {
  const sections = ALL_SECTIONS.map((s) => ({
    ...s,
    isComplete: true, // 11 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Complete")).toBeInTheDocument();
});
