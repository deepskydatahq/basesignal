import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "./auth";

// Mock Clerk and Convex
vi.mock("@clerk/clerk-react", () => ({
  ClerkProvider: ({ children, appearance }: { children: React.ReactNode; appearance?: unknown }) => (
    <div data-testid="clerk-provider" data-appearance={JSON.stringify(appearance)}>
      {children}
    </div>
  ),
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("convex/react-clerk", () => ({
  ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="convex-provider">{children}</div>
  ),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: vi.fn(),
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubEnv("VITE_CONVEX_URL", "https://test.convex.cloud");
  });

  test("renders children within providers", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>
    );

    expect(screen.getByTestId("clerk-provider")).toBeInTheDocument();
    expect(screen.getByTestId("convex-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  test("passes appearance config to ClerkProvider", () => {
    render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    );

    const clerkProvider = screen.getByTestId("clerk-provider");
    const appearance = JSON.parse(clerkProvider.getAttribute("data-appearance") || "{}");

    expect(appearance.baseTheme).toBeDefined();
    expect(appearance.variables?.colorPrimary).toBe("hsl(0, 0%, 0%)");
  });
});
