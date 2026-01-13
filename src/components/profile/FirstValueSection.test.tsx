import { expect, test, vi, describe, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstValueSection } from "./FirstValueSection";

// Mock Convex
let mockDefinition: unknown = null;
const mockUpdateDefinition = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockDefinition,
  useMutation: () => mockUpdateDefinition,
}));

function setup() {
  mockUpdateDefinition.mockReset();
  const user = userEvent.setup();
  render(<FirstValueSection />);
  return { user };
}

beforeEach(() => {
  mockDefinition = null;
  mockUpdateDefinition.mockReset();
});

describe("FirstValueSection", () => {
  describe("undefined state", () => {
    test("shows Not Started badge and Define button", () => {
      mockDefinition = null;
      setup();

      expect(screen.getByText("First Value Moment")).toBeInTheDocument();
      expect(screen.getByText("Not Started")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /define/i })
      ).toBeInTheDocument();
    });
  });
});
