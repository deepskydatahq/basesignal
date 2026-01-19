import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileHeader } from "./ProfileHeader";
import { getProductColor } from "../../lib/productColor";

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

test("shows B2B badge when hasMultiUserAccounts is true", () => {
  setup({ identity: { productName: "My App", hasMultiUserAccounts: true } });

  expect(screen.getByText("B2B")).toBeInTheDocument();
});

test("shows B2B badge when businessType is b2b", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
      businessType: "b2b",
    },
  });

  expect(screen.getByText("B2B")).toBeInTheDocument();
});

test("shows B2C badge when single-user and businessType is b2c", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
      businessType: "b2c",
    },
  });

  expect(screen.getByText("B2C")).toBeInTheDocument();
});

test("shows B2C badge when hasMultiUserAccounts is false and no businessType", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
    },
  });

  expect(screen.getByText("B2C")).toBeInTheDocument();
});

test("renders revenue model badges with formatted labels", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: ["seat_subscription", "transactions"],
    },
  });

  expect(screen.getByText("Seat Subscription")).toBeInTheDocument();
  expect(screen.getByText("Transactions")).toBeInTheDocument();
});

test("handles empty revenueModels array", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: [],
    },
  });

  // Should still render without errors, just no revenue badges
  expect(
    screen.getByRole("heading", { name: "My App" })
  ).toBeInTheDocument();
});

test("handles unknown revenue model gracefully", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: ["unknown_model"],
    },
  });

  // Falls back to displaying the raw value
  expect(screen.getByText("unknown_model")).toBeInTheDocument();
});

test("shows correct count text", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
  });

  expect(screen.getByText("4 of 11")).toBeInTheDocument();
});

test("shows progress bar with correct width for percentage", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 10 },
  });

  // 5/10 = 50%
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "50%" });
});

test("handles 0% completeness", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 0, total: 11 },
  });

  expect(screen.getByText("0 of 11")).toBeInTheDocument();
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "0%" });
});

test("handles 100% completeness", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 11, total: 11 },
  });

  expect(screen.getByText("11 of 11")).toBeInTheDocument();
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "100%" });
});

test("renders logo avatar with product initial", () => {
  setup({ identity: { productName: "Basesignal" } });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
});

test("renders logo avatar with ? for missing product name", () => {
  setup({ identity: {} });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("?");
});

test("applies deterministic background color to avatar", () => {
  setup({ identity: { productName: "Basesignal" } });

  const avatar = screen.getByLabelText("Product avatar");
  const expectedColor = getProductColor("Basesignal");
  expect(avatar).toHaveStyle({ backgroundColor: expectedColor });
});

test("progress bar has accessible progressbar role", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 10 },
  });

  const progressBar = screen.getByRole("progressbar");
  expect(progressBar).toBeInTheDocument();
});

test("progress bar has correct ARIA value attributes", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 7, total: 10 },
  });

  const progressBar = screen.getByRole("progressbar");
  expect(progressBar).toHaveAttribute("aria-valuenow", "70");
  expect(progressBar).toHaveAttribute("aria-valuemin", "0");
  expect(progressBar).toHaveAttribute("aria-valuemax", "100");
});

test("progress bar fill has explicit width transition class", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 10 },
  });

  const progressBarFill = screen.getByTestId("progress-bar-fill");
  expect(progressBarFill).toHaveClass("transition-[width]", "duration-300");
});

test("renders stats bar with metrics, entities, and activities counts", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
    stats: {
      metricsCount: 5,
      entitiesCount: 3,
      activitiesCount: 12,
    },
  });

  expect(screen.getByText(/5 Metrics/)).toBeInTheDocument();
  expect(screen.getByText(/3 Entities/)).toBeInTheDocument();
  expect(screen.getByText(/12 Activities/)).toBeInTheDocument();
});
