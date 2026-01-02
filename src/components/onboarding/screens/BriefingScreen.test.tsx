import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BriefingScreen } from "./BriefingScreen";

// Mock Convex
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("BriefingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the philosophy reminder", () => {
    render(<BriefingScreen productName="TestApp" />);
    expect(
      screen.getByText(/we don't track clicks/i)
    ).toBeInTheDocument();
  });

  it("renders all three checklist items", () => {
    render(<BriefingScreen productName="TestApp" />);
    expect(screen.getByText(/15 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/TestApp's user journey/i)).toBeInTheDocument();
    expect(screen.getByText(/colleague who knows/i)).toBeInTheDocument();
  });

  it("renders all three output cards", () => {
    render(<BriefingScreen productName="TestApp" />);
    expect(screen.getByText("User Journey Map")).toBeInTheDocument();
    expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
    expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  });

  it("shows coming soon badges on placeholder outputs", () => {
    render(<BriefingScreen productName="TestApp" />);
    const comingSoonBadges = screen.getAllByText("Coming soon");
    expect(comingSoonBadges).toHaveLength(2);
  });

  it("renders the CTA button", () => {
    render(<BriefingScreen productName="TestApp" />);
    expect(screen.getByRole("button", { name: /start setup/i })).toBeInTheDocument();
  });

  it("uses fallback text when productName is empty", () => {
    render(<BriefingScreen productName="" />);
    expect(screen.getByText(/your product's user journey/i)).toBeInTheDocument();
  });
});
