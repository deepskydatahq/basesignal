import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBadge } from "./CategoryBadge";

test("renders reach category with blue styling", () => {
  render(<CategoryBadge category="reach" />);

  const badge = screen.getByText("Reach");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-blue-100", "text-blue-700");
});

test("renders engagement category with green styling", () => {
  render(<CategoryBadge category="engagement" />);

  const badge = screen.getByText("Engagement");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-green-100", "text-green-700");
});

test("renders value_delivery category with purple styling", () => {
  render(<CategoryBadge category="value_delivery" />);

  const badge = screen.getByText("Value Delivery");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-purple-100", "text-purple-700");
});

test("renders value_capture category with orange styling", () => {
  render(<CategoryBadge category="value_capture" />);

  const badge = screen.getByText("Value Capture");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-orange-100", "text-orange-700");
});
