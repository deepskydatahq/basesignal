import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileHeader } from "./ProfileHeader";

function setup(props: Partial<Parameters<typeof ProfileHeader>[0]> = {}) {
  const defaultProps = {
    identity: {
      productName: "Test Product",
    },
    completeness: {
      completed: 0,
      total: 11,
    },
    ...props,
  };
  render(<ProfileHeader {...defaultProps} />);
}

test("renders product name", () => {
  setup({ identity: { productName: "My Awesome App" } });

  expect(
    screen.getByRole("heading", { name: "My Awesome App" })
  ).toBeInTheDocument();
});

test("shows fallback when product name is missing", () => {
  setup({ identity: {} });

  expect(
    screen.getByRole("heading", { name: "Your Product" })
  ).toBeInTheDocument();
});

test("renders product description when provided", () => {
  setup({
    identity: {
      productName: "My App",
      productDescription: "A tool for measuring product metrics",
    },
  });

  expect(
    screen.getByText("A tool for measuring product metrics")
  ).toBeInTheDocument();
});

test("omits description when not provided", () => {
  setup({ identity: { productName: "My App" } });

  // Should only have the heading, no paragraph
  expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
});
