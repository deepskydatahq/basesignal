import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityDetailPanel } from "./ActivityDetailPanel";
import type { Id } from "../../../convex/_generated/dataModel";

const mockActivity = {
  name: "Account Created",
  entityName: "Account",
  lifecycleSlot: "account_creation",
};

function setup(props: Partial<Parameters<typeof ActivityDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const onMetricClick = props.onMetricClick ?? vi.fn();
  const onEdit = props.onEdit ?? vi.fn();
  const defaultProps = {
    activity: mockActivity,
    derivedMetrics: [],
    onClose,
    onMetricClick,
    onEdit,
    ...props,
  };
  render(<ActivityDetailPanel {...defaultProps} />);
  return { user, onClose, onMetricClick, onEdit };
}

test("renders activity name in header", () => {
  setup();

  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("calls onClose when close button is clicked", async () => {
  const onClose = vi.fn();
  const { user } = setup({ onClose });

  await user.click(screen.getByRole("button", { name: /close/i }));

  expect(onClose).toHaveBeenCalledOnce();
});

test("renders nothing when activity is null", () => {
  const { container } = render(
    <ActivityDetailPanel
      activity={null}
      derivedMetrics={[]}
      onClose={vi.fn()}
      onMetricClick={vi.fn()}
    />
  );

  expect(container).toBeEmptyDOMElement();
});

test("renders empty state when no derived metrics", () => {
  setup({ derivedMetrics: [] });

  expect(screen.getByText(/no metrics derived/i)).toBeInTheDocument();
});

test("renders derived metrics list", () => {
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
    { id: "m2" as Id<"metrics">, name: "Signup Rate", category: "reach" },
  ];
  setup({ derivedMetrics });

  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
  expect(screen.getByText("Signup Rate")).toBeInTheDocument();
});

test("renders metric category badges", () => {
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
  ];
  setup({ derivedMetrics });

  expect(screen.getByText("Value Delivery")).toBeInTheDocument();
});

test("calls onMetricClick when metric is clicked", async () => {
  const onMetricClick = vi.fn();
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
  ];
  const { user } = setup({ derivedMetrics, onMetricClick });

  await user.click(screen.getByRole("button", { name: /activation rate/i }));

  expect(onMetricClick).toHaveBeenCalledWith("m1");
});

test("calls onEdit when edit button is clicked", async () => {
  const onEdit = vi.fn();
  const { user } = setup({ onEdit });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(onEdit).toHaveBeenCalledOnce();
});
