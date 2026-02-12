import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementSpecSection } from "./MeasurementSpecSection";
import type {
  MeasurementSpec,
  TrackingEvent,
} from "../../../convex/analysis/outputs/types";

function makeEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    name: "test_event",
    description: "A test event",
    properties: [],
    trigger_condition: "When user does something",
    maps_to: { type: "value_moment", moment_id: "vm-1" },
    category: "activation",
    ...overrides,
  };
}

function makeSpec(overrides: Partial<MeasurementSpec> = {}): MeasurementSpec {
  return {
    events: [
      makeEvent({
        name: "user_signed_up",
        description: "User creates account",
        trigger_condition: "Form submission",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
        properties: [
          { name: "plan_type", type: "string", description: "Selected plan" },
          { name: "referral", type: "boolean", description: "Was referred" },
        ],
      }),
      makeEvent({
        name: "feature_used",
        description: "Core feature adopted",
        trigger_condition: "First use of feature",
        category: "activation",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
        properties: [
          {
            name: "feature_name",
            type: "string",
            description: "Name of feature",
          },
        ],
      }),
      makeEvent({
        name: "value_delivered",
        description: "User receives value",
        trigger_condition: "Task completed",
        category: "value",
        maps_to: {
          type: "both",
          moment_id: "vm-2",
          activation_level: 2,
        },
        properties: [],
      }),
      makeEvent({
        name: "user_returned",
        description: "User comes back",
        trigger_condition: "Login after 24h",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 3 },
        properties: [
          {
            name: "days_since_last",
            type: "number",
            description: "Days since last visit",
          },
        ],
      }),
    ],
    total_events: 4,
    activation_levels_covered: [1, 2, 3],
    value_moments_covered: ["vm-1", "vm-2"],
    confidence: 0.85,
    sources: ["source-1"],
    ...overrides,
  };
}

function setup(spec?: MeasurementSpec | null) {
  const user = userEvent.setup();
  const resolvedSpec = arguments.length === 0 ? makeSpec() : spec;
  render(<MeasurementSpecSection measurementSpec={resolvedSpec} />);
  return { user };
}

test("renders empty state when no measurement spec exists", () => {
  setup(null);

  expect(screen.getByTestId("measurement-spec-empty")).toBeInTheDocument();
  expect(
    screen.getByText("No measurement spec available yet.")
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Generate a measurement spec to see tracking events and their properties."
    )
  ).toBeInTheDocument();
});

test("renders empty state when measurement spec is undefined", () => {
  setup(undefined);

  expect(screen.getByTestId("measurement-spec-empty")).toBeInTheDocument();
});

test("summary shows total events, confidence score, and category breakdown counts", () => {
  setup();

  expect(screen.getByText("4 events")).toBeInTheDocument();
  expect(screen.getByText("85% confidence")).toBeInTheDocument();
  expect(screen.getByText("activation (2)")).toBeInTheDocument();
  expect(screen.getByText("value (1)")).toBeInTheDocument();
  expect(screen.getByText("retention (1)")).toBeInTheDocument();
});

test("events grouped by category with header and count badge", () => {
  setup();

  const section = screen.getByTestId("measurement-spec-section");

  // Category headers
  const headings = within(section).getAllByRole("heading");
  const headingTexts = headings.map((h) => h.textContent);
  expect(headingTexts).toContain("activation");
  expect(headingTexts).toContain("value");
  expect(headingTexts).toContain("retention");
});

test("table per category shows event name, description, trigger condition, maps_to badge", () => {
  setup();

  // Activation category events
  expect(screen.getByText("user_signed_up")).toBeInTheDocument();
  expect(screen.getByText("User creates account")).toBeInTheDocument();
  expect(screen.getByText("Form submission")).toBeInTheDocument();
  expect(screen.getByText("Activation L1")).toBeInTheDocument();

  // Value category event
  expect(screen.getByText("value_delivered")).toBeInTheDocument();
  expect(screen.getByText("Both (L2)")).toBeInTheDocument();

  // Retention category event
  expect(screen.getByText("user_returned")).toBeInTheDocument();
  expect(screen.getByText("Activation L3")).toBeInTheDocument();

  // Value moment mapping
  expect(screen.getByText("Value Moment")).toBeInTheDocument();
});

test("collapsible row detail shows properties table when expanded", async () => {
  const { user } = setup();

  // Properties should not be visible initially
  expect(screen.queryByText("plan_type")).not.toBeInTheDocument();

  // Click on the user_signed_up event row to expand it
  const signupButton = screen.getByText("user_signed_up").closest("button")!;
  await user.click(signupButton);

  // Properties table should now be visible
  expect(screen.getByText("plan_type")).toBeInTheDocument();
  expect(screen.getByText("string")).toBeInTheDocument();
  expect(screen.getByText("Selected plan")).toBeInTheDocument();
  expect(screen.getByText("referral")).toBeInTheDocument();
  expect(screen.getByText("boolean")).toBeInTheDocument();
  expect(screen.getByText("Was referred")).toBeInTheDocument();
});

test("collapsible row shows no properties message when event has none", async () => {
  const { user } = setup();

  // Click on the value_delivered event (has no properties)
  const valueButton = screen.getByText("value_delivered").closest("button")!;
  await user.click(valueButton);

  expect(screen.getByText("No properties defined")).toBeInTheDocument();
});
