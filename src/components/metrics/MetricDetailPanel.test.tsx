import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricDetailPanel } from "./MetricDetailPanel";

const mockMetric = {
  name: "Activation Rate",
  definition: "Percentage of users who complete their first value action within 7 days of signup",
  formula: "Users who completed First Project / Users who signed up",
  category: "value_delivery" as const,
  whyItMatters: "Activation rate measures how well you deliver initial value. A low rate signals friction in your onboarding flow.",
  howToImprove: "Simplify onboarding steps, add progress indicators, send reminder emails for incomplete setups.",
};

function setup(props: Partial<Parameters<typeof MetricDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    metric: mockMetric,
    onClose,
    ...props,
  };
  render(<MetricDetailPanel {...defaultProps} />);
  return { user, onClose };
}

test("renders metric name and category badge", () => {
  setup();

  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();
});

test("renders full definition", () => {
  setup();

  expect(screen.getByText(mockMetric.definition)).toBeInTheDocument();
});

test("renders formula in monospace", () => {
  setup();

  const formula = screen.getByText(mockMetric.formula);
  expect(formula).toBeInTheDocument();
  expect(formula).toHaveClass("font-mono");
});

test("renders Why It Matters section", () => {
  setup();

  expect(screen.getByText("Why It Matters")).toBeInTheDocument();
  expect(screen.getByText(mockMetric.whyItMatters)).toBeInTheDocument();
});

test("renders How to Improve section", () => {
  setup();

  expect(screen.getByText("How to Improve")).toBeInTheDocument();
  expect(screen.getByText(mockMetric.howToImprove)).toBeInTheDocument();
});

test("calls onClose when close button is clicked", async () => {
  const onClose = vi.fn();
  const { user } = setup({ onClose });

  await user.click(screen.getByRole("button", { name: /close/i }));

  expect(onClose).toHaveBeenCalledOnce();
});

test("has correct width and positioning classes", () => {
  setup();

  const panel = screen.getByRole("complementary");
  expect(panel).toHaveClass("w-96");
});
