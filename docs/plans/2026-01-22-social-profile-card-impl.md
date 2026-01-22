# Social Profile Card Image Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate downloadable PNG profile cards (1200x630) for social sharing via a Convex HTTP action.

**Architecture:** Server-side generation using satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG). HTTP POST endpoint receives profile data, returns PNG binary. Frontend button triggers download via blob URL.

**Tech Stack:** Convex HTTP actions, satori, @resvg/resvg-js, React, TypeScript

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install satori and resvg-js**

Run:
```bash
npm install satori @resvg/resvg-js
```

Expected: Dependencies added to package.json

**Step 2: Verify installation**

Run:
```bash
npm ls satori @resvg/resvg-js
```

Expected: Both packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add satori and resvg-js for profile card generation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Profile Card HTTP Action

**Files:**
- Modify: `convex/http.ts`

**Step 1: Write the HTTP action handler**

Add the `/api/profile-card` route after the existing `/clerk-webhook` route in `convex/http.ts`:

```typescript
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// Add this interface near the existing WebhookPayload interface
interface ProfileCardData {
  productName: string;
  description?: string;
  stages: string[];
  completeness: string;
  metricsCount: number;
  entitiesCount: number;
}

// Add this route before `export default http;`
http.route({
  path: "/api/profile-card",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const data: ProfileCardData = await request.json();

    // Fetch Inter font for satori
    const fontResponse = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff"
    );
    const fontData = await fontResponse.arrayBuffer();

    const fontBoldResponse = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff"
    );
    const fontBoldData = await fontBoldResponse.arrayBuffer();

    // Generate SVG with satori
    const svg = await satori(
      {
        type: "div",
        props: {
          style: {
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#ffffff",
            padding: "60px",
            fontFamily: "Inter",
          },
          children: [
            // Header: Logo + Branding
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        width: "48px",
                        height: "48px",
                        backgroundColor: "#000",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "24px",
                        fontWeight: 700,
                      },
                      children: "B",
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: { display: "flex", flexDirection: "column" },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "24px", fontWeight: 700 },
                            children: "BASESIGNAL",
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "14px", color: "#666" },
                            children: "Outcome-driven product analytics",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            // Divider
            {
              type: "div",
              props: {
                style: {
                  height: "1px",
                  backgroundColor: "#e5e5e5",
                  marginTop: "24px",
                  marginBottom: "24px",
                },
              },
            },
            // Product Info
            {
              type: "div",
              props: {
                style: {
                  fontSize: "36px",
                  fontWeight: 700,
                  marginBottom: "8px",
                },
                children: data.productName || "Your Product",
              },
            },
            {
              type: "div",
              props: {
                style: {
                  fontSize: "18px",
                  color: "#666",
                  marginBottom: "32px",
                },
                children: data.description || "Product P&L Dashboard",
              },
            },
            // Journey Stages
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "40px",
                  flexWrap: "wrap",
                },
                children: [
                  {
                    type: "span",
                    props: {
                      style: { fontSize: "14px", color: "#666" },
                      children: "Journey:",
                    },
                  },
                  ...data.stages.flatMap((stage, i) => {
                    const items = [
                      {
                        type: "span",
                        props: {
                          style: { fontSize: "16px", fontWeight: 500 },
                          children: stage,
                        },
                      },
                    ];
                    if (i < data.stages.length - 1) {
                      items.push({
                        type: "span",
                        props: {
                          style: { color: "#ccc", fontSize: "16px" },
                          children: "→",
                        },
                      });
                    }
                    return items;
                  }),
                ],
              },
            },
            // Stats Badges
            {
              type: "div",
              props: {
                style: { display: "flex", gap: "24px" },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        padding: "16px 24px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "28px", fontWeight: 700 },
                            children: data.completeness,
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "12px", color: "#666" },
                            children: "Complete",
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        padding: "16px 24px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "28px", fontWeight: 700 },
                            children: String(data.metricsCount),
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "12px", color: "#666" },
                            children: "Metrics",
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        padding: "16px 24px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "28px", fontWeight: 700 },
                            children: String(data.entitiesCount),
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: { fontSize: "12px", color: "#666" },
                            children: "Entities",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            // Footer (spacer + text)
            {
              type: "div",
              props: {
                style: { flexGrow: 1 },
              },
            },
            {
              type: "div",
              props: {
                style: { fontSize: "14px", color: "#999" },
                children: "Built with Basesignal · basesignal.net",
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: fontData,
            weight: 400,
            style: "normal",
          },
          {
            name: "Inter",
            data: fontBoldData,
            weight: 700,
            style: "normal",
          },
        ],
      }
    );

    // Convert SVG to PNG
    const resvg = new Resvg(svg);
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="basesignal-profile.png"',
      },
    });
  }),
});
```

**Step 2: Test manually (development)**

Start convex dev server if not running:
```bash
npx convex dev
```

Test endpoint with curl:
```bash
curl -X POST http://localhost:3001/api/profile-card \
  -H "Content-Type: application/json" \
  -d '{"productName":"Test Product","stages":["Signup","Onboard","Active"],"completeness":"3/11","metricsCount":5,"entitiesCount":2}' \
  --output test-card.png
```

Expected: PNG file generated (open test-card.png to verify)

**Step 3: Commit**

```bash
git add convex/http.ts
git commit -m "feat: add profile card PNG generation HTTP endpoint

Adds /api/profile-card POST endpoint that generates 1200x630 PNG
images using satori + resvg-js for social sharing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Download Button Component

**Files:**
- Create: `src/components/profile/DownloadCardButton.tsx`
- Create: `src/components/profile/DownloadCardButton.test.tsx`

**Step 1: Write the failing test**

Create `src/components/profile/DownloadCardButton.test.tsx`:

```typescript
import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadCardButton } from "./DownloadCardButton";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:test-url");
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

beforeEach(() => {
  mockFetch.mockReset();
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
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

  expect(screen.getByRole("button", { name: /download card/i })).toBeInTheDocument();
});

test("shows loading state while generating", async () => {
  const user = userEvent.setup();

  // Make fetch hang
  mockFetch.mockImplementation(() => new Promise(() => {}));

  render(<DownloadCardButton {...defaultProps} />);

  const button = screen.getByRole("button", { name: /download card/i });
  await user.click(button);

  expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
  expect(screen.getByRole("button")).toBeDisabled();
});

test("sends correct data to API endpoint", async () => {
  const user = userEvent.setup();

  mockFetch.mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob(["test"], { type: "image/png" })),
  });

  render(<DownloadCardButton {...defaultProps} />);

  await user.click(screen.getByRole("button", { name: /download card/i }));

  expect(mockFetch).toHaveBeenCalledWith("/api/profile-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productName: "Test Product",
      description: "A test description",
      stages: ["Signup", "Onboard", "Active"],
      completeness: "3/11",
      metricsCount: 5,
      entitiesCount: 2,
    }),
  });
});

test("triggers download with blob URL", async () => {
  const user = userEvent.setup();

  const mockBlob = new Blob(["test"], { type: "image/png" });
  mockFetch.mockResolvedValueOnce({
    blob: () => Promise.resolve(mockBlob),
  });

  // Mock click on dynamically created anchor
  const clickSpy = vi.fn();
  vi.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "a") {
      const anchor = document.createElement("a");
      anchor.click = clickSpy;
      return anchor;
    }
    return document.createElement(tag);
  });

  render(<DownloadCardButton {...defaultProps} />);

  await user.click(screen.getByRole("button", { name: /download card/i }));

  // Wait for async operations
  await vi.waitFor(() => {
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  expect(clickSpy).toHaveBeenCalled();
  expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
});

test("re-enables button after download completes", async () => {
  const user = userEvent.setup();

  mockFetch.mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob(["test"], { type: "image/png" })),
  });

  render(<DownloadCardButton {...defaultProps} />);

  const button = screen.getByRole("button", { name: /download card/i });
  await user.click(button);

  await vi.waitFor(() => {
    expect(screen.getByRole("button", { name: /download card/i })).not.toBeDisabled();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/components/profile/DownloadCardButton.test.tsx
```

Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/components/profile/DownloadCardButton.tsx`:

```typescript
import { useState } from "react";
import { Download } from "lucide-react";

interface DownloadCardButtonProps {
  productName: string;
  description?: string;
  stages: string[];
  completeness: { completed: number; total: number };
  metricsCount: number;
  entitiesCount: number;
}

export function DownloadCardButton({
  productName,
  description,
  stages,
  completeness,
  metricsCount,
  entitiesCount,
}: DownloadCardButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const response = await fetch("/api/profile-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          description,
          stages,
          completeness: `${completeness.completed}/${completeness.total}`,
          metricsCount,
          entitiesCount,
        }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "basesignal-profile.png";
      a.click();

      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4" />
      {isDownloading ? "Generating..." : "Download Card"}
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- src/components/profile/DownloadCardButton.test.tsx
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/profile/DownloadCardButton.tsx src/components/profile/DownloadCardButton.test.tsx
git commit -m "feat: add DownloadCardButton component with tests

Component triggers profile card PNG generation and download.
Shows loading state while generating.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Integrate Download Button into ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx` (if exists, otherwise skip test modification)
- Modify: `src/components/profile/ProfilePage.tsx`

**Step 1: Check if ProfileHeader has tests**

Run:
```bash
ls src/components/profile/ProfileHeader.test.tsx 2>/dev/null && echo "exists" || echo "no test file"
```

**Step 2: Update ProfileHeader props interface**

Modify `src/components/profile/ProfileHeader.tsx` to accept journey stages:

Add to the `ProfileHeaderProps` interface:
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
  stages?: string[];  // <-- Add this
}
```

**Step 3: Add DownloadCardButton to ProfileHeader**

Import and add the button in the header:

```typescript
import { DownloadCardButton } from "./DownloadCardButton";

// Inside the component, after the stats display, add:
{stats && (
  <DownloadCardButton
    productName={identity.productName || "Your Product"}
    description={identity.productDescription}
    stages={stages || []}
    completeness={completeness}
    metricsCount={stats.metricsCount}
    entitiesCount={stats.entitiesCount}
  />
)}
```

Place the button in the flex row with the completeness indicator and stats.

**Step 4: Update ProfilePage to pass stages**

Modify `src/components/profile/ProfilePage.tsx`:

Extract stage names and pass to ProfileHeader:

```typescript
// After flatMetrics calculation, add:
const stageNames = profileData.journeyMap.stages?.map((s) => s.name) || [];

// Update ProfileHeader props:
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
  stages={stageNames}  // <-- Add this
/>
```

**Step 5: Run all tests to verify nothing broke**

Run:
```bash
npm test -- --run
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfilePage.tsx
git commit -m "feat: integrate download card button into ProfileHeader

Adds 'Download Card' button to profile header that generates
a shareable PNG profile card.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Manual End-to-End Test

**Files:**
- None (manual testing)

**Step 1: Start development servers**

Terminal 1:
```bash
npx convex dev
```

Terminal 2:
```bash
npm run dev
```

**Step 2: Test the full flow**

1. Navigate to http://localhost:5173/profile (or wherever ProfilePage is routed)
2. Verify "Download Card" button appears in the header
3. Click "Download Card"
4. Verify button shows "Generating..." while loading
5. Verify PNG file downloads
6. Open downloaded file and verify:
   - Dimensions are 1200x630
   - Basesignal branding visible
   - Product name displayed
   - Journey stages shown
   - Stats badges appear
   - Footer text present

**Step 3: Test with different data states**

- Profile with no stages defined → should show empty journey
- Profile with no product name → should show "Your Product"
- Profile with long product name → verify it doesn't overflow

---

## Task 6: Run Full Test Suite

**Files:**
- None (verification)

**Step 1: Run all tests**

Run:
```bash
npm test -- --run
```

Expected: All tests PASS

**Step 2: Run linter**

Run:
```bash
npm run lint
```

Expected: No errors

**Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds without errors

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependencies | package.json |
| 2 | Create HTTP action endpoint | convex/http.ts |
| 3 | Add DownloadCardButton component | src/components/profile/DownloadCardButton.tsx, *.test.tsx |
| 4 | Integrate into ProfileHeader | ProfileHeader.tsx, ProfilePage.tsx |
| 5 | Manual E2E testing | - |
| 6 | Run full test suite | - |

## Notes

- **Font loading**: The HTTP action fetches fonts from jsDelivr CDN on each request. If performance becomes an issue, consider caching the font data or bundling fonts.
- **Error handling**: Current implementation has minimal error handling. Consider adding try/catch with user feedback for production.
- **Satori limitations**: Satori uses a subset of CSS. If the card needs more complex styling, the template may need adjustments.
- **HTTP action testing**: `convex-test` doesn't support HTTP action testing directly. The endpoint is tested manually and via component integration tests.
