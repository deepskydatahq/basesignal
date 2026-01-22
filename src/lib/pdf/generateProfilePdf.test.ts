import { describe, expect, test, vi, beforeEach } from "vitest";
import { generateProfilePdf, type ProfilePdfData } from "./generateProfilePdf";

// Mock html2pdf.js
vi.mock("html2pdf.js", () => ({
  default: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

function createTestProfileData(
  overrides: Partial<ProfilePdfData> = {}
): ProfilePdfData {
  return {
    identity: {
      productName: "Test Product",
      websiteUrl: "https://example.com",
      hasMultiUserAccounts: true,
      businessType: "b2b",
      revenueModels: ["seat_subscription"],
    },
    journeyMap: {
      stages: [
        {
          _id: "stage-1",
          name: "Sign Up",
          lifecycleSlot: "account_creation",
          entity: "User",
          action: "Created Account",
        },
        {
          _id: "stage-2",
          name: "First Use",
          lifecycleSlot: "activation",
          entity: "User",
          action: "Completed Onboarding",
        },
      ],
    },
    metricCatalog: {
      metrics: {
        reach: [{ _id: "m1", name: "New Users", category: "reach" }],
        engagement: [{ _id: "m2", name: "DAU", category: "engagement" }],
        value_delivery: [],
        value_capture: [{ _id: "m3", name: "Conversion Rate", category: "value_capture" }],
      },
      totalCount: 3,
    },
    measurementPlan: {
      entities: [
        { _id: "e1", name: "User", description: "End user" },
        { _id: "e2", name: "Account", description: "Organization" },
      ],
      activityCount: 5,
      propertyCount: 12,
    },
    ...overrides,
  };
}

describe("generateProfilePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls html2pdf with product name in filename", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData();
    await generateProfilePdf(data);

    expect(mockInstance.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "Test Product-profile.pdf",
      })
    );
  });

  test("uses fallback filename when product name is missing", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData({
      identity: { productName: undefined },
    });
    await generateProfilePdf(data);

    expect(mockInstance.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "Product-profile.pdf",
      })
    );
  });

  test("generates HTML containing product name header", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData();
    await generateProfilePdf(data);

    const htmlArg = mockInstance.from.mock.calls[0][0] as string;
    expect(htmlArg).toContain("Test Product");
  });

  test("includes journey stages in HTML output", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData();
    await generateProfilePdf(data);

    const htmlArg = mockInstance.from.mock.calls[0][0] as string;
    expect(htmlArg).toContain("Sign Up");
    expect(htmlArg).toContain("User");
    expect(htmlArg).toContain("Created Account");
  });

  test("includes metrics grouped by category", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData();
    await generateProfilePdf(data);

    const htmlArg = mockInstance.from.mock.calls[0][0] as string;
    expect(htmlArg).toContain("Reach");
    expect(htmlArg).toContain("New Users");
    expect(htmlArg).toContain("Engagement");
    expect(htmlArg).toContain("DAU");
  });

  test("includes measurement plan summary", async () => {
    const html2pdf = await import("html2pdf.js");
    const mockInstance = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(html2pdf.default).mockReturnValue(mockInstance);

    const data = createTestProfileData();
    await generateProfilePdf(data);

    const htmlArg = mockInstance.from.mock.calls[0][0] as string;
    expect(htmlArg).toContain("User");
    expect(htmlArg).toContain("Account");
    expect(htmlArg).toContain("5"); // activity count
  });
});
