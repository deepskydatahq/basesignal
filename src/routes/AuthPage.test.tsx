import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "./AuthPage";

// Mock Clerk components
vi.mock("@clerk/clerk-react", () => ({
  SignIn: ({ appearance }: { appearance?: { elements?: Record<string, string> } }) => (
    <div data-testid="sign-in" data-appearance={JSON.stringify(appearance)}>
      Sign In Form
    </div>
  ),
  SignUp: ({ appearance }: { appearance?: { elements?: Record<string, string> } }) => (
    <div data-testid="sign-up" data-appearance={JSON.stringify(appearance)}>
      Sign Up Form
    </div>
  ),
}));

function setup() {
  const user = userEvent.setup();
  render(<AuthPage />);
  return { user };
}

describe("AuthPage", () => {
  test("renders sign in form by default", () => {
    setup();
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-up")).not.toBeInTheDocument();
  });

  test("renders brand name in left panel", () => {
    setup();
    expect(screen.getByText("Basesignal")).toBeInTheDocument();
  });

  test("switches to sign up when clicking sign up link", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(screen.getByTestId("sign-up")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in")).not.toBeInTheDocument();
  });

  test("switches back to sign in when clicking sign in link", async () => {
    const { user } = setup();

    // First switch to sign up
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.getByTestId("sign-up")).toBeInTheDocument();

    // Then switch back to sign in
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
  });

  test("passes appearance config to SignIn component", () => {
    setup();
    const signIn = screen.getByTestId("sign-in");
    const appearance = JSON.parse(signIn.getAttribute("data-appearance") || "{}");

    expect(appearance.elements?.rootBox).toBe("w-full");
    expect(appearance.elements?.card).toBe("shadow-none w-full");
    expect(appearance.elements?.footerAction).toBe("hidden");
  });

  test("passes appearance config to SignUp component", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    const signUp = screen.getByTestId("sign-up");
    const appearance = JSON.parse(signUp.getAttribute("data-appearance") || "{}");

    expect(appearance.elements?.rootBox).toBe("w-full");
    expect(appearance.elements?.card).toBe("shadow-none w-full");
    expect(appearance.elements?.footerAction).toBe("hidden");
  });
});
