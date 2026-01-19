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
      expect(
        screen.getByText("What moment turns a visitor into a believer?")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Finding your first value reveals whether you're activating users fast enough.")
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

    test("displays activity with 'Activity' label", () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: null,
        source: "manual_edit",
      };
      setup();

      expect(screen.getByText("Activity")).toBeInTheDocument();
      expect(screen.getByText("Report Created")).toBeInTheDocument();
    });

    test("displays timeframe with 'Expected' label", () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: null,
        source: "manual_edit",
      };
      setup();

      expect(screen.getByText("Expected")).toBeInTheDocument();
      expect(screen.getByText("Within 3 days")).toBeInTheDocument();
    });
  });

  describe("confirmed state", () => {
    test("shows Complete badge and confirmation date", () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: 1736553600000, // Jan 11, 2025
        source: "interview",
      };
      setup();

      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("Report Created")).toBeInTheDocument();
      expect(screen.getByText(/jan 11, 2025/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    test("shows Status label with check icon and confirmed date", () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: 1736553600000, // Jan 11, 2025
        source: "interview",
      };
      setup();

      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText(/confirmed jan 11, 2025/i)).toBeInTheDocument();
    });
  });

  describe("edit form toggle", () => {
    test("clicking Define opens edit form", async () => {
      mockDefinition = null;
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /define/i }));

      expect(screen.getByLabelText(/activity name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expected timeframe/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    test("clicking Edit opens form with current values", async () => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: 1736553600000,
        source: "interview",
      };
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /edit/i }));

      expect(screen.getByLabelText(/activity name/i)).toHaveValue(
        "Report Created"
      );
    });
  });

  describe("form submission", () => {
    test("calls mutation on save", async () => {
      mockDefinition = null;
      mockUpdateDefinition.mockResolvedValue("def123");
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.type(
        screen.getByLabelText(/activity name/i),
        "Project Published"
      );
      await user.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => {
        expect(mockUpdateDefinition).toHaveBeenCalledWith({
          activityName: "Project Published",
          reasoning: "",
          expectedTimeframe: "Within 3 days",
        });
      });
    });

    test("shows validation error for empty activity name", async () => {
      mockDefinition = null;
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(
        screen.getByText(/activity name is required/i)
      ).toBeInTheDocument();
      expect(mockUpdateDefinition).not.toHaveBeenCalled();
    });

    test("cancel closes form without saving", async () => {
      mockDefinition = null;
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.type(screen.getByLabelText(/activity name/i), "Test");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(
        screen.queryByLabelText(/activity name/i)
      ).not.toBeInTheDocument();
      expect(mockUpdateDefinition).not.toHaveBeenCalled();
    });
  });
});
