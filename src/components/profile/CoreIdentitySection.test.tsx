import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoreIdentitySection } from "./CoreIdentitySection";

// Mock Convex
const mockMutate = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => mockMutate,
}));

interface CoreIdentityData {
  productName?: string;
  websiteUrl?: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

function setup(data: CoreIdentityData = {}) {
  mockMutate.mockReset();
  const user = userEvent.setup();
  render(<CoreIdentitySection data={data} />);
  return { user, mockMutate };
}

test("renders product name when provided", () => {
  setup({ productName: "Acme App" });

  expect(screen.getByText("Acme App")).toBeInTheDocument();
});

test("renders website as clickable link", () => {
  setup({ websiteUrl: "https://acme.com" });

  const link = screen.getByRole("link", { name: /acme\.com/i });
  expect(link).toHaveAttribute("href", "https://acme.com");
  expect(link).toHaveAttribute("target", "_blank");
});

test("renders business model for multi-user B2B", () => {
  setup({ hasMultiUserAccounts: true });

  expect(screen.getByText("B2B · Multi-user accounts")).toBeInTheDocument();
});

test("renders business model for single-user B2C", () => {
  setup({ hasMultiUserAccounts: false, businessType: "b2c" });

  expect(screen.getByText("B2C · Single-user accounts")).toBeInTheDocument();
});

test("renders business model for single-user B2B", () => {
  setup({ hasMultiUserAccounts: false, businessType: "b2b" });

  expect(screen.getByText("B2B · Single-user accounts")).toBeInTheDocument();
});

test("renders revenue models as comma-separated list", () => {
  setup({ revenueModels: ["seat_subscription", "volume_based"] });

  expect(screen.getByText("Seat-based, Usage-based")).toBeInTheDocument();
});

test("renders empty state when no data provided", () => {
  setup({});

  expect(screen.getByText("No profile information yet")).toBeInTheDocument();
});
