import { expect, test, vi } from "vitest";
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

test("renders all 11 sections in checklist when expanded", async () => {
  const { user } = setup();

  await user.click(screen.getByRole("button"));

  expect(screen.getByText("Core Identity")).toBeInTheDocument();
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();
  expect(screen.getByText("First Value Moment")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();
  expect(screen.getByText("Activation Definition")).toBeInTheDocument();
  expect(screen.getByText("Active Definition")).toBeInTheDocument();
  expect(screen.getByText("At-Risk Signals")).toBeInTheDocument();
  expect(screen.getByText("Churn Definition")).toBeInTheDocument();
  expect(screen.getByText("Expansion Triggers")).toBeInTheDocument();
});

test("shows check icon for complete sections and circle for incomplete", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: false },
  ];
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  // Check for data-complete attribute on the list items by querying list
  const listItems = screen.getAllByRole("listitem");
  const coreIdentityItem = listItems.find((item) =>
    item.textContent?.includes("Core Identity")
  );
  const journeyMapItem = listItems.find((item) =>
    item.textContent?.includes("User Journey Map")
  );

  expect(coreIdentityItem).toHaveAttribute("data-complete", "true");
  expect(journeyMapItem).toHaveAttribute("data-complete", "false");
});

test("shows CTA button with first incomplete section name", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: true },
    { id: "first_value", label: "First Value Moment", isComplete: false },
    { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
  ];
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  expect(
    screen.getByRole("button", { name: /Complete First Value Moment/i })
  ).toBeInTheDocument();
});

test("hides CTA when all sections are complete", async () => {
  const sections = ALL_SECTIONS.map((s) => ({ ...s, isComplete: true }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  // The trigger button should still exist, but no CTA button inside popover
  const buttons = screen.getAllByRole("button");
  const ctaButton = buttons.find((btn) => btn.textContent?.includes("Complete "));
  expect(ctaButton).toBeUndefined();
});

test("CTA scrolls to first incomplete section and closes popover", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: false },
  ];

  // Create a mock element for the scroll target
  const mockElement = document.createElement("div");
  mockElement.id = "section-journey_map";
  mockElement.scrollIntoView = vi.fn();
  document.body.appendChild(mockElement);

  const { user } = setup(sections);

  // Open popover
  await user.click(screen.getByRole("button"));
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();

  // Click CTA
  await user.click(screen.getByRole("button", { name: /Complete User Journey Map/i }));

  // Verify scroll was called
  expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
    behavior: "smooth",
    block: "start",
  });

  // Verify popover closes (checklist no longer visible)
  expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();

  // Cleanup
  document.body.removeChild(mockElement);
});

// Boundary threshold tests
test('boundary: 3 sections shows "Getting Started"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 3,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
});

test('boundary: 4 sections shows "Taking Shape"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 4,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('boundary: 6 sections shows "Taking Shape"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 6,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('boundary: 7 sections shows "Well Defined"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 7,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('boundary: 9 sections shows "Well Defined"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 9,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('boundary: 10 sections shows "Complete"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 10,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("handles 0 sections complete", async () => {
  const { user } = setup(); // All false by default

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
  expect(screen.getByText("0 of 11")).toBeInTheDocument();
});
