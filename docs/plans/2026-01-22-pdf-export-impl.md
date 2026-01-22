# PDF Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single-click PDF export button to ProfileHeader that generates a PDF of the complete product profile.

**Architecture:** Client-side PDF generation using html2pdf.js. ExportPdfButton component calls generateProfilePdf() which builds an HTML template from profile data and triggers a browser download.

**Tech Stack:** html2pdf.js, React, TypeScript

---

## Task 1: Add html2pdf.js dependency

**Files:**
- Modify: `package.json`

**Step 1: Install html2pdf.js**

Run:
```bash
npm install html2pdf.js
```

**Step 2: Verify installation**

Run: `npm ls html2pdf.js`
Expected: Shows html2pdf.js in dependency tree

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2pdf.js dependency for PDF export"
```

---

## Task 2: Create generateProfilePdf function

**Files:**
- Create: `src/lib/pdf/generateProfilePdf.ts`
- Create: `src/lib/pdf/generateProfilePdf.test.ts`

**Step 1: Write the failing test**

Create `src/lib/pdf/generateProfilePdf.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/pdf/generateProfilePdf.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create the directory and implementation**

Create `src/lib/pdf/generateProfilePdf.ts`:

```typescript
import html2pdf from "html2pdf.js";
import {
  METRIC_CATEGORIES,
  CATEGORY_INFO,
  type MetricCategory,
} from "../../shared/metricTemplates";
import {
  LIFECYCLE_SLOTS,
  SLOT_INFO,
  type LifecycleSlot,
} from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}

interface Metric {
  _id: string;
  name: string;
  category: string;
}

interface Entity {
  _id: string;
  name: string;
  description?: string;
}

export interface ProfilePdfData {
  identity: {
    productName?: string;
    websiteUrl?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: string;
    revenueModels?: string[];
  };
  journeyMap: {
    stages: Stage[];
  };
  metricCatalog: {
    metrics: Record<MetricCategory, Metric[]>;
    totalCount: number;
  };
  measurementPlan: {
    entities: Entity[];
    activityCount: number;
    propertyCount: number;
  };
}

const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

function buildHtml(data: ProfilePdfData): string {
  const productName = data.identity.productName || "Product";
  const businessType = data.identity.hasMultiUserAccounts
    ? "B2B"
    : data.identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  // Build journey table rows
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  data.journeyMap.stages.forEach((stage) => {
    if (stage.lifecycleSlot && !stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  const journeyRows = LIFECYCLE_SLOTS.map((slot) => {
    const stage = stageBySlot.get(slot);
    const slotName = SLOT_INFO[slot].name;
    if (stage) {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${slotName}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.name}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.entity || "-"}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.action || "-"}</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">${slotName}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
      </tr>
    `;
  }).join("");

  // Build metrics sections
  const metricsSections = METRIC_CATEGORIES.map((category) => {
    const metrics = data.metricCatalog.metrics[category] || [];
    const categoryInfo = CATEGORY_INFO[category];
    if (metrics.length === 0) {
      return `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">${categoryInfo.label}</h4>
          <p style="margin: 0; color: #9ca3af; font-size: 13px;">No metrics defined</p>
        </div>
      `;
    }
    const metricList = metrics
      .map((m) => `<li style="margin: 2px 0;">${m.name}</li>`)
      .join("");
    return `
      <div style="margin-bottom: 12px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px;">${categoryInfo.label}</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">${metricList}</ul>
      </div>
    `;
  }).join("");

  // Build entities list
  const entitiesList = data.measurementPlan.entities
    .map((e) => `<li style="margin: 2px 0;">${e.name}${e.description ? ` - ${e.description}` : ""}</li>`)
    .join("");

  // Revenue models
  const revenueModels = (data.identity.revenueModels || [])
    .map((m) => REVENUE_MODEL_LABELS[m] || m)
    .join(", ");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #111827;">
      <!-- Header -->
      <div style="margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
        <h1 style="margin: 0 0 8px 0; font-size: 28px;">${productName}</h1>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="background: #111827; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${businessType}</span>
          ${revenueModels ? `<span style="background: #f3f4f6; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${revenueModels}</span>` : ""}
        </div>
        ${data.identity.websiteUrl ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px;">${data.identity.websiteUrl}</p>` : ""}
      </div>

      <!-- Journey Map -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Journey Map</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Lifecycle Stage</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Stage Name</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Entity</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${journeyRows}
          </tbody>
        </table>
      </div>

      <!-- Metric Catalog -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Metric Catalog</h2>
        ${metricsSections}
      </div>

      <!-- Measurement Plan -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Measurement Plan</h2>
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px;">Entities (${data.measurementPlan.entities.length})</h4>
          ${entitiesList ? `<ul style="margin: 0; padding-left: 20px; font-size: 13px;">${entitiesList}</ul>` : '<p style="margin: 0; color: #9ca3af; font-size: 13px;">No entities defined</p>'}
        </div>
        <div style="font-size: 13px; color: #6b7280;">
          <span>${data.measurementPlan.activityCount} activities</span> ·
          <span>${data.measurementPlan.propertyCount} properties</span>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
        Generated by Basesignal · ${new Date().toLocaleDateString()}
      </div>
    </div>
  `;
}

export async function generateProfilePdf(data: ProfilePdfData): Promise<void> {
  const productName = data.identity.productName || "Product";
  const filename = `${productName}-profile.pdf`;

  const html = buildHtml(data);

  const options = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  };

  await html2pdf().set(options).from(html).save();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/pdf/generateProfilePdf.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/pdf/
git commit -m "feat: add generateProfilePdf function for PDF export"
```

---

## Task 3: Create ExportPdfButton component

**Files:**
- Create: `src/components/profile/ExportPdfButton.tsx`
- Create: `src/components/profile/ExportPdfButton.test.tsx`

**Step 1: Write the failing test**

Create `src/components/profile/ExportPdfButton.test.tsx`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ExportPdfButton.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/components/profile/ExportPdfButton.tsx`:

```typescript
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateProfilePdf,
  type ProfilePdfData,
} from "../../lib/pdf/generateProfilePdf";

interface ExportPdfButtonProps {
  profileData: ProfilePdfData;
}

export function ExportPdfButton({ profileData }: ExportPdfButtonProps) {
  const handleExport = () => {
    generateProfilePdf(profileData);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleExport}>
      <Download className="w-4 h-4 mr-1" />
      Export PDF
    </Button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ExportPdfButton.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/profile/ExportPdfButton.tsx src/components/profile/ExportPdfButton.test.tsx
git commit -m "feat: add ExportPdfButton component"
```

---

## Task 4: Update ProfileHeader to accept profileData prop

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/profile/ProfileHeader.test.tsx`:

```typescript
import userEvent from "@testing-library/user-event";

// Add mock for generateProfilePdf at top of file
vi.mock("../../lib/pdf/generateProfilePdf", () => ({
  generateProfilePdf: vi.fn().mockResolvedValue(undefined),
}));

// Update the setup function to include profileData
function setup(props: Partial<Parameters<typeof ProfileHeader>[0]> = {}) {
  const defaultProps = {
    identity: {
      productName: "Test Product",
    },
    completeness: {
      completed: 0,
      total: 11,
    },
    profileData: {
      identity: { productName: "Test Product" },
      journeyMap: { stages: [] },
      metricCatalog: {
        metrics: { reach: [], engagement: [], value_delivery: [], value_capture: [] },
        totalCount: 0,
      },
      measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    },
    ...props,
  };
  render(<ProfileHeader {...defaultProps} />);
}

// Add new tests at end of file
test("renders Export PDF button when profileData is provided", () => {
  setup();

  expect(screen.getByRole("button", { name: /export pdf/i })).toBeInTheDocument();
});

test("does not render Export PDF button when profileData is not provided", () => {
  const defaultProps = {
    identity: { productName: "Test Product" },
    completeness: { completed: 0, total: 11 },
  };
  render(<ProfileHeader {...defaultProps} />);

  expect(screen.queryByRole("button", { name: /export pdf/i })).not.toBeInTheDocument();
});

test("Export PDF button calls generateProfilePdf with profileData when clicked", async () => {
  const user = userEvent.setup();
  const { generateProfilePdf } = await import("../../lib/pdf/generateProfilePdf");

  const profileData = {
    identity: { productName: "My Product" },
    journeyMap: { stages: [] },
    metricCatalog: {
      metrics: { reach: [], engagement: [], value_delivery: [], value_capture: [] },
      totalCount: 0,
    },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  };
  setup({ profileData });

  const button = screen.getByRole("button", { name: /export pdf/i });
  await user.click(button);

  expect(generateProfilePdf).toHaveBeenCalledWith(profileData);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfileHeader.test.tsx`
Expected: FAIL - profileData prop not recognized

**Step 3: Update ProfileHeader component**

Modify `src/components/profile/ProfileHeader.tsx`:

1. Add import at top:
```typescript
import { ExportPdfButton } from "./ExportPdfButton";
import type { ProfilePdfData } from "../../lib/pdf/generateProfilePdf";
```

2. Update ProfileHeaderProps interface to add optional profileData:
```typescript
interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
  };
  stats?: {
    metricsCount: number;
    entitiesCount: number;
    activitiesCount: number;
  };
  profileData?: ProfilePdfData;
}
```

3. Add profileData to destructured props:
```typescript
export function ProfileHeader({
  identity,
  completeness,
  stats,
  profileData,
}: ProfileHeaderProps) {
```

4. Add ExportPdfButton in the header after the completeness indicator div (around line 115), inside the `<div className="flex items-center gap-2">`:
```typescript
        {/* Collapsed completeness indicator */}
        <div className="flex items-center gap-2">
          {profileData && <ExportPdfButton profileData={profileData} />}
          <div
            role="progressbar"
            // ... rest of progressbar
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ProfileHeader.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat: add Export PDF button to ProfileHeader"
```

---

## Task 5: Update ProfilePage to pass profileData to ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`
- Modify: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/profile/ProfilePage.test.tsx`:

```typescript
// Add mock for generateProfilePdf
vi.mock("../../lib/pdf/generateProfilePdf", () => ({
  generateProfilePdf: vi.fn().mockResolvedValue(undefined),
}));

test("renders Export PDF button when profile data is loaded", async () => {
  // Mock authenticated user with profile data
  mockUseQuery.mockImplementation((query) => {
    if (query === api.profile.getProfileData) {
      return {
        identity: { productName: "Test Product" },
        journeyMap: { stages: [], journeyId: null },
        firstValue: null,
        metricCatalog: {
          metrics: { reach: [], engagement: [], value_delivery: [], value_capture: [] },
          totalCount: 0,
        },
        measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
        completeness: { sections: [], completed: 0, total: 11, percentage: 0 },
      };
    }
    if (query === api.measurementPlan.getFullPlan) {
      return [];
    }
    return undefined;
  });

  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  expect(screen.getByRole("button", { name: /export pdf/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: FAIL - Export PDF button not found

**Step 3: Update ProfilePage to pass profileData**

Modify `src/components/profile/ProfilePage.tsx`:

In the return statement, update the ProfileHeader component to include profileData:

```typescript
<ProfileHeader
  identity={{
    ...profileData.identity,
    businessType: profileData.identity.businessType as "b2b" | "b2c" | undefined,
  }}
  completeness={profileData.completeness}
  stats={{
    metricsCount: profileData.metricCatalog.totalCount,
    entitiesCount: profileData.measurementPlan.entities.length,
    activitiesCount: profileData.measurementPlan.activityCount,
  }}
  profileData={{
    identity: profileData.identity,
    journeyMap: { stages: profileData.journeyMap.stages },
    metricCatalog: profileData.metricCatalog,
    measurementPlan: profileData.measurementPlan,
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "feat: wire profileData from ProfilePage to ProfileHeader for PDF export"
```

---

## Task 6: Add TypeScript type declaration for html2pdf.js

**Files:**
- Create: `src/types/html2pdf.d.ts`

**Step 1: Check if types exist**

Run: `npm ls @types/html2pdf.js`
Expected: Not found (html2pdf.js doesn't have official types)

**Step 2: Create type declaration file**

Create `src/types/html2pdf.d.ts`:

```typescript
declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean };
    jsPDF?: { unit?: string; format?: string; orientation?: "portrait" | "landscape" };
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: string | HTMLElement): Html2PdfInstance;
    save(): Promise<void>;
  }

  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors related to html2pdf.js

**Step 4: Commit**

```bash
git add src/types/html2pdf.d.ts
git commit -m "chore: add TypeScript declarations for html2pdf.js"
```

---

## Task 7: Run full test suite and verify

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests PASS

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Manual verification (optional)**

1. Start dev server: `npm run dev`
2. Navigate to profile page
3. Click "Export PDF" button
4. Verify PDF downloads with correct filename and content

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | package.json | Add html2pdf.js dependency |
| 2 | src/lib/pdf/generateProfilePdf.ts, .test.ts | Create PDF generation function |
| 3 | src/components/profile/ExportPdfButton.tsx, .test.tsx | Create button component |
| 4 | src/components/profile/ProfileHeader.tsx, .test.tsx | Add button to header |
| 5 | src/components/profile/ProfilePage.tsx, .test.tsx | Wire profileData prop |
| 6 | src/types/html2pdf.d.ts | Add TypeScript types |
| 7 | - | Run full test suite |

Total: 7 tasks, 8 files created/modified
