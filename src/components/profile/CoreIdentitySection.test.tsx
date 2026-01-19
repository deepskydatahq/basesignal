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

test("renders multiple revenue models as separate badges", () => {
  setup({ revenueModels: ["seat_subscription", "volume_based"] });

  // Each model renders as a separate badge, not comma-separated
  expect(screen.getByText("Seat-based")).toBeInTheDocument();
  expect(screen.getByText("Usage-based")).toBeInTheDocument();
});

test("renders empty state when no data provided", () => {
  setup({});

  expect(screen.getByText("Your product's P&L starts here.")).toBeInTheDocument();
  expect(
    screen.getByText("How you monetize and who you serve determines which metrics matter most.")
  ).toBeInTheDocument();
});

test("shows Complete status when productName is set", () => {
  setup({ productName: "Acme App" });

  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("shows Not Started status when productName is not set", () => {
  setup({});

  expect(screen.getByText("Not Started")).toBeInTheDocument();
});

test("shows edit form when Edit button is clicked", async () => {
  const { user } = setup({ productName: "Acme App" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
});

test("edit form shows multi-user account options", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(
    screen.getByText("Can an account have multiple users?")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
});

test("edit form shows revenue model checkboxes", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByLabelText("One-time transactions")).toBeInTheDocument();
  expect(screen.getByLabelText("Tier subscription")).toBeInTheDocument();
  expect(screen.getByLabelText("Seat-based subscription")).toBeInTheDocument();
  expect(screen.getByLabelText("Usage/credit-based")).toBeInTheDocument();
});

test("Save button calls updateOnboarding mutation", async () => {
  const { user, mockMutate } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));
  await user.clear(screen.getByLabelText(/product name/i));
  await user.type(screen.getByLabelText(/product name/i), "New Name");
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({ productName: "New Name" })
  );
});

test("Cancel button reverts changes and closes edit form", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));
  await user.clear(screen.getByLabelText(/product name/i));
  await user.type(screen.getByLabelText(/product name/i), "Changed Name");
  await user.click(screen.getByRole("button", { name: /cancel/i }));

  // Should be back in display mode with original value
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.queryByLabelText(/product name/i)).not.toBeInTheDocument();
});

test("renders revenue models as styled badges", () => {
  setup({ revenueModels: ["transactions", "tier_subscription"] });

  // Each revenue model should be a separate badge element
  const transactionsBadge = screen.getByText("Transactions");
  const tierBadge = screen.getByText("Tier subscription");

  // Badges should have badge styling classes
  expect(transactionsBadge).toHaveClass("rounded-full");
  expect(tierBadge).toHaveClass("rounded-full");
});
