import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityJoinScreen } from "./CommunityJoinScreen";

// Mock Convex hooks
const mockVerify = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    mode: "honor",
    discordInvite: "https://discord.gg/test",
  })),
  useMutation: vi.fn(() => mockVerify),
}));

function setup(props: { onNext?: () => void; onBack?: () => void } = {}) {
  const user = userEvent.setup();
  const onNext = props.onNext ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();
  render(<CommunityJoinScreen onNext={onNext} onBack={onBack} />);
  return {
    user,
    onNext,
    onBack,
    getContinueButton: () => screen.getByRole("button", { name: /^continue$/i }),
    getBackButton: () => screen.getByRole("button", { name: /^back$/i }),
    getDiscordButton: () => screen.getByRole("link", { name: /join discord/i }),
    getCheckbox: () => screen.getByRole("checkbox"),
  };
}

beforeEach(() => {
  mockVerify.mockClear();
  mockVerify.mockResolvedValue({ success: true });
});

test("renders community join content", () => {
  setup();

  expect(
    screen.getByText(/join our early adopter community/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/basesignal is launching/i)).toBeInTheDocument();
  expect(screen.getByText(/this isn't optional/i)).toBeInTheDocument();
});

test("Discord link opens in new tab", () => {
  const { getDiscordButton } = setup();

  const link = getDiscordButton();
  expect(link).toHaveAttribute("href", "https://discord.gg/test");
  expect(link).toHaveAttribute("target", "_blank");
});

test("Continue button is disabled until checkbox is checked in honor mode", async () => {
  const { user, getContinueButton, getCheckbox } = setup();

  expect(getContinueButton()).toBeDisabled();

  await user.click(getCheckbox());

  expect(getContinueButton()).toBeEnabled();
});

test("calls verify mutation and onNext when continuing in honor mode", async () => {
  const onNext = vi.fn();
  const { user, getContinueButton, getCheckbox } = setup({ onNext });

  await user.click(getCheckbox());
  await user.click(getContinueButton());

  await waitFor(() => {
    expect(mockVerify).toHaveBeenCalledWith({ method: "honor" });
  });
  await waitFor(() => {
    expect(onNext).toHaveBeenCalled();
  });
});

test("calls onBack when Back button is clicked", async () => {
  const onBack = vi.fn();
  const { user, getBackButton } = setup({ onBack });

  await user.click(getBackButton());

  expect(onBack).toHaveBeenCalled();
});

test("email fallback enables Continue button", async () => {
  const mockOpen = vi.fn();
  vi.stubGlobal("open", mockOpen);

  const { user, getContinueButton } = setup();

  expect(getContinueButton()).toBeDisabled();

  const emailLink = screen.getByRole("button", { name: /email us/i });
  await user.click(emailLink);

  expect(mockOpen).toHaveBeenCalledWith(
    expect.stringContaining("mailto:support@basesignal.com"),
    "_blank"
  );
  expect(getContinueButton()).toBeEnabled();

  vi.unstubAllGlobals();
});
