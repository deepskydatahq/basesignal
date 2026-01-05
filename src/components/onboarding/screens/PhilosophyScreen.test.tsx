import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhilosophyScreen } from "./PhilosophyScreen";

function setup(props: { onNext?: () => void } = {}) {
  const user = userEvent.setup();
  const onNext = props.onNext ?? vi.fn();
  render(<PhilosophyScreen onNext={onNext} />);
  return {
    user,
    onNext,
    getContinueButton: () => screen.getByRole("button", { name: /continue/i }),
  };
}

test("renders philosophy content with journey visualization", () => {
  setup();

  // Problem statement
  expect(
    screen.getByText(/typical tracking plans focus on interactions/i)
  ).toBeInTheDocument();

  // Shift statement
  expect(
    screen.getByText(/basesignal measures performance/i)
  ).toBeInTheDocument();

  // Journey visualization stages
  expect(screen.getByText("Signup")).toBeInTheDocument();
  expect(screen.getByText("Setup")).toBeInTheDocument();
  expect(screen.getByText("Activated")).toBeInTheDocument();
});

test("calls onNext when Continue is clicked", async () => {
  const onNext = vi.fn();
  const { user, getContinueButton } = setup({ onNext });

  await user.click(getContinueButton());

  expect(onNext).toHaveBeenCalledOnce();
});
