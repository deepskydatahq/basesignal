import { expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

test("renders singular form for count of 1", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 1, total: 11 },
    stats: {
      metricsCount: 1,
      entitiesCount: 1,
      activitiesCount: 1,
    },
  });

  expect(screen.getByText(/1 Metric/)).toBeInTheDocument();
  expect(screen.getByText(/1 Entity/)).toBeInTheDocument();
  expect(screen.getByText(/1 Activity/)).toBeInTheDocument();
});

test("renders zero counts correctly", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 0, total: 11 },
    stats: {
      metricsCount: 0,
      entitiesCount: 0,
      activitiesCount: 0,
    },
  });

  expect(screen.getByText(/0 Metrics/)).toBeInTheDocument();
  expect(screen.getByText(/0 Entities/)).toBeInTheDocument();
  expect(screen.getByText(/0 Activities/)).toBeInTheDocument();
});

test("falls back to completeness display when stats not provided", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
    // No stats prop
  });

  expect(screen.getByText("4 of 11")).toBeInTheDocument();
  expect(screen.queryByText(/Metrics/)).not.toBeInTheDocument();
});

test("renders CompletenessIndicator when sections provided", () => {
  setup({
    identity: { productName: "My App" },
    completeness: {
      completed: 3,
      total: 4,
      sections: [
        { id: "core_identity", label: "Core Identity", isComplete: true },
        { id: "journey_map", label: "User Journey Map", isComplete: true },
        { id: "first_value", label: "First Value Moment", isComplete: true },
        { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
      ],
    },
  });

  // Should show the count in the trigger button
  expect(screen.getByText("3 of 4")).toBeInTheDocument();
  // Should have a button that can be clicked to expand
  expect(screen.getByRole("button")).toBeInTheDocument();
});

test("falls back to simple progress bar when sections is empty array", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 11, sections: [] },
  });

  // Should show the simple text, not a button
  expect(screen.getByText("5 of 11")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

test("renders favicon image when websiteUrl is provided", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "https://basesignal.net",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  const img = avatar.querySelector("img");
  expect(img).toBeInTheDocument();
  expect(img).toHaveAttribute(
    "src",
    "https://www.google.com/s2/favicons?domain=basesignal.net&sz=128"
  );
  expect(img).toHaveAttribute("alt", "Basesignal favicon");
});

test("renders initial avatar when websiteUrl is not provided", () => {
  setup({
    identity: {
      productName: "Basesignal",
      // No websiteUrl
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
  expect(avatar.querySelector("img")).not.toBeInTheDocument();
});

test("renders initial avatar when websiteUrl is invalid", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "not-a-valid-url",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
  expect(avatar.querySelector("img")).not.toBeInTheDocument();
});

test("falls back to initial when favicon fails to load", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "https://nonexistent-domain-12345.com",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  const img = avatar.querySelector("img");
  expect(img).toBeInTheDocument();

  // Simulate image load error
  fireEvent.error(img!);

  // Image should be hidden, initial should show
  expect(img).toHaveStyle({ display: "none" });
  expect(avatar).toHaveTextContent("B");
});
