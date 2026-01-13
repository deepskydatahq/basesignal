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

  describe("defined state (pending confirmation)", () => {
    test("shows In Progress badge and activity name", () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: null,
        source: "manual_edit",
      };
      setup();

      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Report Created")).toBeInTheDocument();
      expect(screen.getByText(/within 3 days/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });
  });
});
