import { expect, test, vi, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingMaturityScreen } from "./TrackingMaturityScreen";

function setup(props: Partial<Parameters<typeof TrackingMaturityScreen>[0]> = {}) {
  const user = userEvent.setup();
  const onNext = props.onNext ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();

  render(
    <TrackingMaturityScreen
      onNext={onNext}
      onBack={onBack}
      {...props}
    />
  );

  return {
    user,
    onNext,
    onBack,
    getContinueButton: () => screen.getByRole("button", { name: /continue/i }),
    getBackButton: () => screen.getByRole("button", { name: /back/i }),
  };
}

describe("TrackingMaturityScreen", () => {
  test("renders all three question sections", () => {
    setup();

    // Question 1: Tracking status
    expect(screen.getByText(/do you have a tracking setup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fully implemented/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /incomplete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /just started/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /starting from scratch/i })).toBeInTheDocument();

    // Question 2: Pain point
    expect(screen.getByText(/biggest tracking challenge/i)).toBeInTheDocument();

    // Question 3: Tools
    expect(screen.getByText(/what analytics tools/i)).toBeInTheDocument();
  });

  test("continue button disabled until all sections complete", async () => {
    const { user, getContinueButton } = setup();

    // Initially disabled
    expect(getContinueButton()).toBeDisabled();

    // Select tracking status
    await user.click(screen.getByRole("button", { name: /fully implemented/i }));
    expect(getContinueButton()).toBeDisabled();

    // Select pain point
    await user.click(screen.getByRole("button", { name: /don't know what to track/i }));
    expect(getContinueButton()).toBeDisabled();

    // Select at least one tool
    await user.click(screen.getByRole("checkbox", { name: /amplitude/i }));
    expect(getContinueButton()).toBeEnabled();
  });

  test("calls onNext with collected data when continue clicked", async () => {
    const { user, onNext, getContinueButton } = setup();

    // Fill all required fields
    await user.click(screen.getByRole("button", { name: /incomplete/i }));
    await user.click(screen.getByRole("button", { name: /inconsistent/i }));
    await user.click(screen.getByRole("checkbox", { name: /mixpanel/i }));
    await user.click(screen.getByRole("checkbox", { name: /segment/i }));

    await user.click(getContinueButton());

    expect(onNext).toHaveBeenCalledWith({
      trackingStatus: "partial",
      trackingPainPoint: "inconsistent",
      trackingPainPointOther: undefined,
      analyticsTools: ["mixpanel", "segment"],
    });
  });

  test("shows text input when other pain point selected", async () => {
    const { user, onNext, getContinueButton } = setup();

    // Select "Other" pain point
    await user.click(screen.getByRole("button", { name: /fully implemented/i }));
    await user.click(screen.getByRole("button", { name: /^other$/i }));

    // Text input should appear
    const textInput = screen.getByPlaceholderText(/describe your challenge/i);
    expect(textInput).toBeInTheDocument();

    // Continue still disabled without text
    await user.click(screen.getByRole("checkbox", { name: /amplitude/i }));
    expect(getContinueButton()).toBeDisabled();

    // Add text
    await user.type(textInput, "Our data is siloed");
    expect(getContinueButton()).toBeEnabled();

    await user.click(getContinueButton());

    expect(onNext).toHaveBeenCalledWith({
      trackingStatus: "full",
      trackingPainPoint: "other",
      trackingPainPointOther: "Our data is siloed",
      analyticsTools: ["amplitude"],
    });
  });

  test("calls onBack when back button clicked", async () => {
    const { user, onBack, getBackButton } = setup();

    await user.click(getBackButton());

    expect(onBack).toHaveBeenCalled();
  });

  test("preserves initial data when provided", () => {
    setup({
      initialData: {
        trackingStatus: "minimal",
        trackingPainPoint: "trust",
        analyticsTools: ["posthog"],
      },
    });

    // Tracking status should be selected
    const minimalButton = screen.getByRole("button", { name: /just started/i });
    expect(minimalButton).toHaveClass("bg-black");

    // Pain point should be selected
    const trustButton = screen.getByRole("button", { name: /stakeholders don't trust/i });
    expect(trustButton).toHaveClass("bg-black");

    // Tool should be checked
    const posthogCheckbox = screen.getByRole("checkbox", { name: /posthog/i });
    expect(posthogCheckbox).toBeChecked();
  });
});
