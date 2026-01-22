import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPdfButton } from "./ExportPdfButton";
import type { ProfilePdfData } from "../../lib/pdf/generateProfilePdf";

// Mock the generateProfilePdf function
vi.mock("../../lib/pdf/generateProfilePdf", () => ({
  generateProfilePdf: vi.fn().mockResolvedValue(undefined),
}));

function createTestProfileData(): ProfilePdfData {
  return {
    identity: {
      productName: "Test Product",
    },
    journeyMap: {
      stages: [],
    },
    metricCatalog: {
      metrics: {
        reach: [],
        engagement: [],
        value_delivery: [],
        value_capture: [],
      },
      totalCount: 0,
    },
    measurementPlan: {
      entities: [],
      activityCount: 0,
      propertyCount: 0,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders export button with download icon", () => {
  render(<ExportPdfButton profileData={createTestProfileData()} />);

  const button = screen.getByRole("button", { name: /export pdf/i });
  expect(button).toBeInTheDocument();
});

test("calls generateProfilePdf when clicked", async () => {
  const user = userEvent.setup();
  const { generateProfilePdf } = await import("../../lib/pdf/generateProfilePdf");

  const profileData = createTestProfileData();
  render(<ExportPdfButton profileData={profileData} />);

  const button = screen.getByRole("button", { name: /export pdf/i });
  await user.click(button);

  expect(generateProfilePdf).toHaveBeenCalledWith(profileData);
});

test("passes profile data to generateProfilePdf", async () => {
  const user = userEvent.setup();
  const { generateProfilePdf } = await import("../../lib/pdf/generateProfilePdf");

  const profileData = createTestProfileData();
  profileData.identity.productName = "Custom Product";
  render(<ExportPdfButton profileData={profileData} />);

  const button = screen.getByRole("button", { name: /export pdf/i });
  await user.click(button);

  expect(generateProfilePdf).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: expect.objectContaining({
        productName: "Custom Product",
      }),
    })
  );
});
