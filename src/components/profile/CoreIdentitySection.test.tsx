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
