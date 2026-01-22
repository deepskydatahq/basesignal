import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadCardButton } from "./DownloadCardButton";

// Mock html-to-image
vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const defaultProps = {
  productName: "Test Product",
  description: "A test description",
  stages: ["Signup", "Onboard", "Active"],
  completeness: { completed: 3, total: 11 },
  metricsCount: 5,
  entitiesCount: 2,
};

test("renders download button", () => {
  render(<DownloadCardButton {...defaultProps} />);

  expect(
    screen.getByRole("button", { name: /download card/i })
  ).toBeInTheDocument();
});

test("shows loading state while generating", async () => {
  const user = userEvent.setup();
  const { toPng } = await import("html-to-image");

  // Make toPng hang
  vi.mocked(toPng).mockImplementation(() => new Promise(() => {}));

  render(<DownloadCardButton {...defaultProps} />);

  const button = screen.getByRole("button", { name: /download card/i });
  await user.click(button);

  expect(
    screen.getByRole("button", { name: /generating/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("button")).toBeDisabled();
});

test("calls toPng and creates download link", async () => {
  const user = userEvent.setup();
  const { toPng } = await import("html-to-image");

  // Mock toPng to return a data URL
  const mockDataUrl = "data:image/png;base64,test";
  vi.mocked(toPng).mockResolvedValueOnce(mockDataUrl);

  render(<DownloadCardButton {...defaultProps} />);

  await user.click(screen.getByRole("button", { name: /download card/i }));

  await waitFor(() => {
    expect(toPng).toHaveBeenCalled();
  });

  // Verify toPng was called with options
  expect(toPng).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({
      width: 1200,
      height: 630,
    })
  );
});

test("re-enables button after download completes", async () => {
  const user = userEvent.setup();
  const { toPng } = await import("html-to-image");

  vi.mocked(toPng).mockResolvedValueOnce("data:image/png;base64,test");

  render(<DownloadCardButton {...defaultProps} />);

  const button = screen.getByRole("button", { name: /download card/i });
  await user.click(button);

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /download card/i })
    ).not.toBeDisabled();
  });
});

test("renders hidden card template for image generation", () => {
  render(<DownloadCardButton {...defaultProps} />);

  // The card template should exist but be positioned off-screen
  const cardContainer = document.querySelector('[style*="position: absolute"]');
  expect(cardContainer).toBeInTheDocument();
});
