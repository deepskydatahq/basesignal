import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementSpecSection } from "./MeasurementSpecSection";
import type {
  MeasurementSpec,
  TrackingEvent,
  EntityDefinition,
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
          {
            name: "plan_type",
            type: "string",
            description: "Selected plan",
            isRequired: true,
          },
          {
            name: "referral",
            type: "boolean",
            description: "Was referred",
            isRequired: false,
          },
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
            isRequired: true,
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
            isRequired: false,
          },
        ],
      }),
    ],
    total_events: 4,
    coverage: {
      activation_levels_covered: [1, 2, 3],
      value_moments_covered: ["vm-1", "vm-2"],
    },
    confidence: 0.85,
    sources: ["source-1"],
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EntityDefinition> = {}): EntityDefinition {
  return {
    id: "entity_user",
    name: "User",
    description: "A registered user of the platform",
    properties: [
      {
        name: "user_id",
        type: "string",
        description: "Unique identifier",
        isRequired: true,
      },
      {
        name: "email",
        type: "string",
        description: "User email address",
        isRequired: true,
      },
      {
        name: "plan",
        type: "string",
        description: "Subscription plan",
        isRequired: false,
      },
    ],
    ...overrides,
  };
}

function makeEntitySpec(): MeasurementSpec {
  const userEntity = makeEntity();
  const projectEntity = makeEntity({
    id: "entity_project",
    name: "Project",
    description: "A workspace for organizing tasks",
    properties: [
      {
        name: "project_id",
        type: "string",
        description: "Unique project ID",
        isRequired: true,
      },
      {
        name: "member_count",
        type: "number",
        description: "Number of members",
        isRequired: false,
      },
    ],
  });

  return makeSpec({
    entities: [userEntity, projectEntity],
    events: [
      makeEvent({
        name: "user_signed_up",
        description: "User creates account",
        trigger_condition: "Form submission",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
        entity_id: "entity_user",
        properties: [
          {
            name: "plan_type",
            type: "string",
            description: "Selected plan",
            isRequired: true,
          },
        ],
      }),
      makeEvent({
        name: "user_activated",
        description: "User reaches activation",
        trigger_condition: "Completes onboarding",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
        entity_id: "entity_user",
        properties: [],
      }),
      makeEvent({
        name: "project_created",
        description: "New project created",
        trigger_condition: "User creates project",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
        entity_id: "entity_project",
        properties: [],
      }),
      makeEvent({
        name: "system_health_check",
        description: "Periodic health check",
        trigger_condition: "Every 24h",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 3 },
        properties: [],
        // No entity_id — this is an ungrouped event
      }),
    ],
    total_events: 4,
  });
}

function setup(spec?: MeasurementSpec | null) {
  const user = userEvent.setup();
  const resolvedSpec = arguments.length === 0 ? makeSpec() : spec;
  render(<MeasurementSpecSection measurementSpec={resolvedSpec} />);
  return { user };
}

// --- Legacy / Category view tests ---

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

test("legacy data without entities shows category view with toggle hidden", () => {
  setup(); // makeSpec() has no entities

  // Category view should be rendered
  expect(screen.getByText("activation")).toBeInTheDocument();

  // Toggle should not be present
  expect(screen.queryByText("By Entity")).not.toBeInTheDocument();
  expect(screen.queryByText("By Category")).not.toBeInTheDocument();
});

// --- Entity view tests ---

test("entity view rendered by default when entities exist", () => {
  setup(makeEntitySpec());

  // Entity cards should be visible
  expect(screen.getByTestId("entity-card-entity_user")).toBeInTheDocument();
  expect(screen.getByTestId("entity-card-entity_project")).toBeInTheDocument();

  // Category headers should NOT be visible (entity view is default)
  const headings = screen.getAllByRole("heading");
  const headingTexts = headings.map((h) => h.textContent);
  expect(headingTexts).not.toContain("activation");
  expect(headingTexts).not.toContain("value");
});

test("entity card renders name, description, and event count badge", () => {
  setup(makeEntitySpec());

  const userCard = screen.getByTestId("entity-card-entity_user");
  expect(within(userCard).getByText("User")).toBeInTheDocument();
  expect(
    within(userCard).getByText("A registered user of the platform")
  ).toBeInTheDocument();
  expect(within(userCard).getByText("2 events")).toBeInTheDocument();

  const projectCard = screen.getByTestId("entity-card-entity_project");
  expect(within(projectCard).getByText("Project")).toBeInTheDocument();
  expect(within(projectCard).getByText("1 event")).toBeInTheDocument();
});

test("entity card includes property table with name, type, required, description", () => {
  setup(makeEntitySpec());

  const userCard = screen.getByTestId("entity-card-entity_user");

  // Property table headers
  expect(within(userCard).getByText("Required")).toBeInTheDocument();

  // Property rows
  expect(within(userCard).getByText("user_id")).toBeInTheDocument();
  expect(within(userCard).getByText("Unique identifier")).toBeInTheDocument();
  expect(within(userCard).getByText("email")).toBeInTheDocument();
  expect(within(userCard).getByText("User email address")).toBeInTheDocument();
  expect(within(userCard).getByText("plan")).toBeInTheDocument();
  expect(within(userCard).getByText("Subscription plan")).toBeInTheDocument();

  // Required column values (2 Yes, 1 No for user entity)
  const yeses = within(userCard).getAllByText("Yes");
  const nos = within(userCard).getAllByText("No");
  expect(yeses).toHaveLength(2);
  expect(nos).toHaveLength(1);
});

test("events nested under parent entity using EventRow", () => {
  setup(makeEntitySpec());

  const userCard = screen.getByTestId("entity-card-entity_user");
  expect(within(userCard).getByText("user_signed_up")).toBeInTheDocument();
  expect(within(userCard).getByText("user_activated")).toBeInTheDocument();

  const projectCard = screen.getByTestId("entity-card-entity_project");
  expect(within(projectCard).getByText("project_created")).toBeInTheDocument();
});

test("toggle switches between entity and category views", async () => {
  const { user } = setup(makeEntitySpec());

  // Entity view is default
  expect(screen.getByTestId("entity-card-entity_user")).toBeInTheDocument();

  // Click "By Category" toggle
  await user.click(screen.getByText("By Category"));

  // Entity cards should disappear
  expect(
    screen.queryByTestId("entity-card-entity_user")
  ).not.toBeInTheDocument();

  // Category headers should appear
  expect(screen.getByText("activation (2)")).toBeInTheDocument();
  expect(screen.getByText("value (1)")).toBeInTheDocument();
  expect(screen.getByText("retention (1)")).toBeInTheDocument();

  // Click "By Entity" to go back
  await user.click(screen.getByText("By Entity"));
  expect(screen.getByTestId("entity-card-entity_user")).toBeInTheDocument();
});

test("summary bar shows entity count alongside event count", () => {
  setup(makeEntitySpec());

  expect(screen.getByText("4 events")).toBeInTheDocument();
  expect(screen.getByText("2 entities")).toBeInTheDocument();
  expect(screen.getByText("85% confidence")).toBeInTheDocument();
});

test("events without entity_id shown in Ungrouped section", () => {
  setup(makeEntitySpec());

  const ungrouped = screen.getByTestId("ungrouped-events");
  expect(within(ungrouped).getByText("Ungrouped")).toBeInTheDocument();
  expect(within(ungrouped).getByText("1 event")).toBeInTheDocument();
  expect(
    within(ungrouped).getByText("system_health_check")
  ).toBeInTheDocument();
});

test("single entity shows singular entity label in summary", () => {
  const spec = makeSpec({
    entities: [makeEntity()],
    events: [
      makeEvent({ entity_id: "entity_user" }),
    ],
    total_events: 1,
  });
  setup(spec);

  expect(screen.getByText("1 entity")).toBeInTheDocument();
});
