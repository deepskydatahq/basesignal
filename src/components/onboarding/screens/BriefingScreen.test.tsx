import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BriefingScreen } from "./BriefingScreen";

// Mock Convex
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}));

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

function setup(props: { productName?: string } = {}) {
  const productName = props.productName ?? "TestApp";
  render(<BriefingScreen productName={productName} />);
  return {
    getStartButton: () => screen.getByRole("button", { name: /start setup/i }),
  };
}

test("renders preparation checklist and output cards", () => {
  setup({ productName: "Acme" });

  // Philosophy reminder
  expect(screen.getByText(/we don't track clicks/i)).toBeInTheDocument();

  // Checklist items
  expect(screen.getByText(/15 minutes/i)).toBeInTheDocument();
  expect(screen.getByText(/Acme's user journey/i)).toBeInTheDocument();
  expect(screen.getByText(/colleague who knows/i)).toBeInTheDocument();

  // Output cards
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();

  // Fallback text when productName is empty
  const { unmount } = render(<BriefingScreen productName="" />);
  expect(screen.getByText(/your product's user journey/i)).toBeInTheDocument();
  unmount();
});

test("shows coming soon badges and has start button enabled", () => {
  const { getStartButton } = setup();

  // Coming soon badges on placeholder outputs
  const comingSoonBadges = screen.getAllByText("Coming soon");
  expect(comingSoonBadges).toHaveLength(2);

  // CTA button is present and enabled
  const startButton = getStartButton();
  expect(startButton).toBeInTheDocument();
  expect(startButton).toBeEnabled();
});
