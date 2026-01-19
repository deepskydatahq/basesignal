import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SuggestedNextAction } from "./SuggestedNextAction";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type NextSection = "journey_map" | "metric_catalog" | "measurement_plan" | null;

function setup(props: {
  nextSection: NextSection;
  lastCompleted: string | null;
}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SuggestedNextAction {...props} />
    </MemoryRouter>
  );
  return { user };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test("returns null when nextSection is null", () => {
  const { container } = render(
    <MemoryRouter>
      <SuggestedNextAction nextSection={null} lastCompleted="measurement_plan" />
    </MemoryRouter>
  );

  expect(container).toBeEmptyDOMElement();
});

test("renders journey_map suggestion with contextual heading after core_identity", () => {
  setup({ nextSection: "journey_map", lastCompleted: "core_identity" });

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
  expect(screen.getByText(/10-minute conversation/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Overview Interview" })).toBeInTheDocument();
});

test("renders journey_map suggestion with default heading when no lastCompleted", () => {
  setup({ nextSection: "journey_map", lastCompleted: null });

  expect(screen.getByText("Map your user journey")).toBeInTheDocument();
});

test("navigates to /setup/interview when journey_map CTA clicked", async () => {
  const { user } = setup({ nextSection: "journey_map", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Start Overview Interview" }));

  expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
});

test("renders metric_catalog suggestion with contextual heading after first_value", () => {
  setup({ nextSection: "metric_catalog", lastCompleted: "first_value" });

  expect(screen.getByText("Turn your first value moment into metrics")).toBeInTheDocument();
  expect(screen.getByText(/complete set of product metrics/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Metrics" })).toBeInTheDocument();
});

test("renders metric_catalog suggestion with default heading when lastCompleted is not first_value", () => {
  setup({ nextSection: "metric_catalog", lastCompleted: "journey_map" });

  expect(screen.getByText("Generate your metric catalog")).toBeInTheDocument();
});

test("navigates to /metric-catalog when metric_catalog CTA clicked", async () => {
  const { user } = setup({ nextSection: "metric_catalog", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Generate Metrics" }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("renders measurement_plan suggestion", () => {
  setup({ nextSection: "measurement_plan", lastCompleted: "metric_catalog" });

  expect(screen.getByText("Connect metrics to your data")).toBeInTheDocument();
  expect(screen.getByText(/Map your metrics to events/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Build Measurement Plan" })).toBeInTheDocument();
});

test("navigates to /measurement-plan when measurement_plan CTA clicked", async () => {
  const { user } = setup({ nextSection: "measurement_plan", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Build Measurement Plan" }));

  expect(mockNavigate).toHaveBeenCalledWith("/measurement-plan");
});

test("renders with blue background styling", () => {
  setup({ nextSection: "journey_map", lastCompleted: null });

  const container = screen.getByText("Map your user journey").closest("div");
  expect(container).toHaveClass("bg-blue-50");
  expect(container).toHaveClass("border-blue-200");
});
