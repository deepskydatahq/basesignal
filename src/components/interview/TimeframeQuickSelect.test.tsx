import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeframeQuickSelect } from "./TimeframeQuickSelect";

function setup(props: Partial<Parameters<typeof TimeframeQuickSelect>[0]> = {}) {
  const user = userEvent.setup();
  const onSelect = props.onSelect ?? vi.fn();
  const defaultProps = {
    onSelect,
    ...props,
  };
  render(<TimeframeQuickSelect {...defaultProps} />);
  return { user, onSelect };
}

test("renders all timeframe options", () => {
  setup();

  expect(screen.getByRole("button", { name: /first session/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /24 hours/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /first week/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /other/i })).toBeInTheDocument();
});

test("calls onSelect when option is clicked", async () => {
  const { user, onSelect } = setup();

  await user.click(screen.getByRole("button", { name: /24 hours/i }));

  expect(onSelect).toHaveBeenCalledWith("Within 24 hours");
});

test("shows selected state for active option", () => {
  setup({ selected: "Within first session" });

  const selectedButton = screen.getByRole("button", { name: /first session/i });
  expect(selectedButton).toHaveAttribute("aria-pressed", "true");
});
