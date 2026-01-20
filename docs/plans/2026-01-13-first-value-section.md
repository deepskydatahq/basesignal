# FirstValueSection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-contained card component that displays the user's first value moment definition with three states (undefined, defined, confirmed) and inline editing capability.

**Architecture:** Standalone card component using existing shadcn/ui primitives (Card, Badge, Button, Input, Select). Uses `useQuery(api.firstValue.getDefinition)` for data and `useMutation(api.firstValue.updateDefinition)` for persistence. Three visual states: undefined (gray badge + "Define" button), defined (blue badge + content), confirmed (green badge + date).

**Tech Stack:** React 19, Convex, shadcn/ui (Card, Badge, Button), Tailwind CSS, Vitest + RTL for testing

---

## Task 1: Create FirstValueSection Test File

**Files:**
- Create: `src/components/profile/FirstValueSection.test.tsx`

**Step 1: Write the failing test for undefined state**

```tsx
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstValueSection } from "./FirstValueSection";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const mockUpdateDefinition = vi.fn();

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => null, // undefined state
    useMutation: () => mockUpdateDefinition,
  };
});

function setup() {
  const user = userEvent.setup();
  const client = new ConvexReactClient("https://test.convex.cloud");

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  return { user };
}

test("renders undefined state with Not defined badge and Define button", () => {
  setup();

  expect(screen.getByText("First Value Moment")).toBeInTheDocument();
  expect(screen.getByText("Not defined")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /define/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: FAIL - Cannot find module './FirstValueSection'

**Step 3: Create minimal component to pass the test**

Create file `src/components/profile/FirstValueSection.tsx`:

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>First Value Moment</CardTitle>
        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
          Not defined
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Define the moment when users first experience value from your product.
        </p>
        <Button>Define</Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add FirstValueSection with undefined state

Creates the initial component with "Not defined" badge and Define button.
First of three states: undefined, defined, confirmed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Defined State Rendering

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Write the failing test for defined state**

Add to test file (create new test file section with different mock):

```tsx
// Create a separate test file or use describe blocks with different mocks
// For simplicity, we'll add conditional tests based on mock return value

// Add this test with a new describe block:
import { expect, test, vi, describe, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Move mock to module level with configurable return
let mockDefinition: unknown = null;
const mockUpdateDefinition = vi.fn();

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => mockDefinition,
    useMutation: () => mockUpdateDefinition,
  };
});

function setup() {
  const user = userEvent.setup();
  const client = new ConvexReactClient("https://test.convex.cloud");

  const { FirstValueSection } = require("./FirstValueSection");

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  return { user };
}

beforeEach(() => {
  mockDefinition = null;
  mockUpdateDefinition.mockReset();
  vi.resetModules();
});

describe("FirstValueSection", () => {
  test("renders undefined state with Not defined badge and Define button", async () => {
    mockDefinition = null;
    const { FirstValueSection } = await import("./FirstValueSection");
    const client = new ConvexReactClient("https://test.convex.cloud");

    render(
      <ConvexProvider client={client}>
        <FirstValueSection />
      </ConvexProvider>
    );

    expect(screen.getByText("First Value Moment")).toBeInTheDocument();
    expect(screen.getByText("Not defined")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /define/i })).toBeInTheDocument();
  });

  test("renders defined state with activity name and timeframe", async () => {
    mockDefinition = {
      activityName: "Report Created",
      reasoning: "When users create their first report",
      expectedTimeframe: "Within 3 days",
      confirmedAt: null,
      source: "manual_edit",
    };
    const { FirstValueSection } = await import("./FirstValueSection");
    const client = new ConvexReactClient("https://test.convex.cloud");

    render(
      <ConvexProvider client={client}>
        <FirstValueSection />
      </ConvexProvider>
    );

    expect(screen.getByText("First Value Moment")).toBeInTheDocument();
    expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
    expect(screen.getByText("Report Created")).toBeInTheDocument();
    expect(screen.getByText(/within 3 days/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: FAIL - "Pending confirmation" not found (component always shows undefined state)

**Step 3: Update component to handle defined state**

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);

  // Three states: undefined, defined (not confirmed), confirmed
  const status = !definition
    ? "not_defined"
    : definition.confirmedAt
      ? "confirmed"
      : "pending";

  if (status === "not_defined") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>First Value Moment</CardTitle>
          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
            Not defined
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Define the moment when users first experience value from your product.
          </p>
          <Button>Define</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>First Value Moment</CardTitle>
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Pending confirmation
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-medium text-gray-900 mb-2">
          {definition.activityName}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Expected: {definition.expectedTimeframe}
        </p>
        <Button variant="outline">Edit</Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add defined state to FirstValueSection

Shows activity name, expected timeframe, and "Pending confirmation" badge
when definition exists but hasn't been confirmed yet.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Confirmed State Rendering

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Write the failing test for confirmed state**

Add to test file:

```tsx
test("renders confirmed state with green badge and confirmation date", async () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: 1736553600000, // Jan 11, 2026
    source: "interview",
  };
  const { FirstValueSection } = await import("./FirstValueSection");
  const client = new ConvexReactClient("https://test.convex.cloud");

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  expect(screen.getByText("Confirmed")).toBeInTheDocument();
  expect(screen.getByText("Report Created")).toBeInTheDocument();
  expect(screen.getByText(/jan 11, 2026/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: FAIL - "Confirmed" badge not found (shows "Pending confirmation")

**Step 3: Update component to handle confirmed state**

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);

  // Three states: undefined, defined (not confirmed), confirmed
  const status = !definition
    ? "not_defined"
    : definition.confirmedAt
      ? "confirmed"
      : "pending";

  if (status === "not_defined") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>First Value Moment</CardTitle>
          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
            Not defined
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Define the moment when users first experience value from your product.
          </p>
          <Button>Define</Button>
        </CardContent>
      </Card>
    );
  }

  const isConfirmed = status === "confirmed";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>First Value Moment</CardTitle>
        {isConfirmed ? (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        ) : (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending confirmation
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-lg font-medium text-gray-900 mb-2">
          {definition.activityName}
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>Expected: {definition.expectedTimeframe}</span>
          {isConfirmed && definition.confirmedAt && (
            <span>Confirmed: {formatDate(definition.confirmedAt)}</span>
          )}
        </div>
        <Button variant="outline">Edit</Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add confirmed state to FirstValueSection

Shows green "Confirmed" badge with checkmark and confirmation date
when definition has been confirmed through interview or manual edit.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Inline Edit Form Toggle

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Write the failing test for edit form toggle**

Add to test file:

```tsx
test("clicking Define button shows inline edit form", async () => {
  mockDefinition = null;
  const { FirstValueSection } = await import("./FirstValueSection");
  const client = new ConvexReactClient("https://test.convex.cloud");
  const user = userEvent.setup();

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  await user.click(screen.getByRole("button", { name: /define/i }));

  expect(screen.getByLabelText(/activity name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/expected timeframe/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});

test("clicking Edit button shows inline edit form with current values", async () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: 1736553600000,
    source: "interview",
  };
  const { FirstValueSection } = await import("./FirstValueSection");
  const client = new ConvexReactClient("https://test.convex.cloud");
  const user = userEvent.setup();

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByLabelText(/activity name/i)).toHaveValue("Report Created");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: FAIL - Cannot find element with label "Activity name"

**Step 3: Add edit form state and toggle**

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";

const TIMEFRAME_OPTIONS = [
  "Within 1 day",
  "Within 3 days",
  "Within 1 week",
  "Within 2 weeks",
  "Within 1 month",
];

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);
  const [isEditing, setIsEditing] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [expectedTimeframe, setExpectedTimeframe] = useState(TIMEFRAME_OPTIONS[1]);

  const status = !definition
    ? "not_defined"
    : definition.confirmedAt
      ? "confirmed"
      : "pending";

  const handleEditClick = () => {
    if (definition) {
      setActivityName(definition.activityName);
      setExpectedTimeframe(definition.expectedTimeframe);
    } else {
      setActivityName("");
      setExpectedTimeframe(TIMEFRAME_OPTIONS[1]);
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>First Value Moment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="activityName">Activity name</Label>
            <Input
              id="activityName"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g., Report Created"
            />
          </div>
          <div>
            <Label htmlFor="expectedTimeframe">Expected timeframe</Label>
            <Select value={expectedTimeframe} onValueChange={setExpectedTimeframe}>
              <SelectTrigger id="expectedTimeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button>Save</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "not_defined") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>First Value Moment</CardTitle>
          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
            Not defined
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Define the moment when users first experience value from your product.
          </p>
          <Button onClick={handleEditClick}>Define</Button>
        </CardContent>
      </Card>
    );
  }

  const isConfirmed = status === "confirmed";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>First Value Moment</CardTitle>
        {isConfirmed ? (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        ) : (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending confirmation
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-lg font-medium text-gray-900 mb-2">
          {definition.activityName}
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>Expected: {definition.expectedTimeframe}</span>
          {isConfirmed && definition.confirmedAt && (
            <span>Confirmed: {formatDate(definition.confirmedAt)}</span>
          )}
        </div>
        <Button variant="outline" onClick={handleEditClick}>
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add inline edit form toggle to FirstValueSection

Define and Edit buttons now open an inline form with activity name input
and expected timeframe select. Cancel button closes the form.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Form Submission with Mutation

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Write the failing test for form submission**

Add to test file:

```tsx
test("submitting form calls updateDefinition mutation", async () => {
  mockDefinition = null;
  mockUpdateDefinition.mockResolvedValue("def123");
  const { FirstValueSection } = await import("./FirstValueSection");
  const client = new ConvexReactClient("https://test.convex.cloud");
  const user = userEvent.setup();

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  // Open form
  await user.click(screen.getByRole("button", { name: /define/i }));

  // Fill form
  await user.type(screen.getByLabelText(/activity name/i), "Project Published");

  // Submit
  await user.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => {
    expect(mockUpdateDefinition).toHaveBeenCalledWith({
      activityName: "Project Published",
      reasoning: "",
      expectedTimeframe: "Within 3 days",
    });
  });
});

test("shows validation error when activity name is empty", async () => {
  mockDefinition = null;
  const { FirstValueSection } = await import("./FirstValueSection");
  const client = new ConvexReactClient("https://test.convex.cloud");
  const user = userEvent.setup();

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  // Open form
  await user.click(screen.getByRole("button", { name: /define/i }));

  // Submit without filling
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(screen.getByText(/activity name is required/i)).toBeInTheDocument();
  expect(mockUpdateDefinition).not.toHaveBeenCalled();
});
```

Add import at top:

```tsx
import { waitFor } from "@testing-library/react";
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: FAIL - mockUpdateDefinition not called

**Step 3: Add form submission logic**

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";

const TIMEFRAME_OPTIONS = [
  "Within 1 day",
  "Within 3 days",
  "Within 1 week",
  "Within 2 weeks",
  "Within 1 month",
];

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);
  const updateDefinition = useMutation(api.firstValue.updateDefinition);

  const [isEditing, setIsEditing] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [expectedTimeframe, setExpectedTimeframe] = useState(TIMEFRAME_OPTIONS[1]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const status = !definition
    ? "not_defined"
    : definition.confirmedAt
      ? "confirmed"
      : "pending";

  const handleEditClick = () => {
    if (definition) {
      setActivityName(definition.activityName);
      setExpectedTimeframe(definition.expectedTimeframe);
    } else {
      setActivityName("");
      setExpectedTimeframe(TIMEFRAME_OPTIONS[1]);
    }
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!activityName.trim()) {
      setError("Activity name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateDefinition({
        activityName: activityName.trim(),
        reasoning: "",
        expectedTimeframe,
      });
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>First Value Moment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="activityName">Activity name</Label>
            <Input
              id="activityName"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g., Report Created"
            />
          </div>
          <div>
            <Label htmlFor="expectedTimeframe">Expected timeframe</Label>
            <Select value={expectedTimeframe} onValueChange={setExpectedTimeframe}>
              <SelectTrigger id="expectedTimeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "not_defined") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>First Value Moment</CardTitle>
          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
            Not defined
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Define the moment when users first experience value from your product.
          </p>
          <Button onClick={handleEditClick}>Define</Button>
        </CardContent>
      </Card>
    );
  }

  const isConfirmed = status === "confirmed";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>First Value Moment</CardTitle>
        {isConfirmed ? (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        ) : (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending confirmation
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-lg font-medium text-gray-900 mb-2">
          {definition.activityName}
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>Expected: {definition.expectedTimeframe}</span>
          {isConfirmed && definition.confirmedAt && (
            <span>Confirmed: {formatDate(definition.confirmedAt)}</span>
          )}
        </div>
        <Button variant="outline" onClick={handleEditClick}>
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add form submission to FirstValueSection

Save button calls updateDefinition mutation. Shows validation error
when activity name is empty. Disables buttons during save operation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final Test Cleanup and Verification

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`

**Step 1: Consolidate and clean up tests**

Rewrite the test file with proper organization:

```tsx
import { expect, test, vi, describe, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, ConvexReactClient } from "convex/react";

let mockDefinition: unknown = null;
const mockUpdateDefinition = vi.fn();

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => mockDefinition,
    useMutation: () => mockUpdateDefinition,
  };
});

async function setup() {
  vi.resetModules();
  const { FirstValueSection } = await import("./FirstValueSection");
  const user = userEvent.setup();
  const client = new ConvexReactClient("https://test.convex.cloud");

  render(
    <ConvexProvider client={client}>
      <FirstValueSection />
    </ConvexProvider>
  );

  return { user };
}

beforeEach(() => {
  mockDefinition = null;
  mockUpdateDefinition.mockReset();
});

describe("FirstValueSection", () => {
  describe("undefined state", () => {
    test("shows Not defined badge and Define button", async () => {
      mockDefinition = null;
      await setup();

      expect(screen.getByText("First Value Moment")).toBeInTheDocument();
      expect(screen.getByText("Not defined")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /define/i })).toBeInTheDocument();
    });

    test("clicking Define opens edit form", async () => {
      mockDefinition = null;
      const { user } = await setup();

      await user.click(screen.getByRole("button", { name: /define/i }));

      expect(screen.getByLabelText(/activity name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expected timeframe/i)).toBeInTheDocument();
    });
  });

  describe("defined state (pending confirmation)", () => {
    beforeEach(() => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: null,
        source: "manual_edit",
      };
    });

    test("shows Pending confirmation badge and activity name", async () => {
      await setup();

      expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
      expect(screen.getByText("Report Created")).toBeInTheDocument();
      expect(screen.getByText(/within 3 days/i)).toBeInTheDocument();
    });

    test("clicking Edit opens form with current values", async () => {
      const { user } = await setup();

      await user.click(screen.getByRole("button", { name: /edit/i }));

      expect(screen.getByLabelText(/activity name/i)).toHaveValue("Report Created");
    });
  });

  describe("confirmed state", () => {
    beforeEach(() => {
      mockDefinition = {
        activityName: "Report Created",
        reasoning: "When users create their first report",
        expectedTimeframe: "Within 3 days",
        confirmedAt: 1736553600000, // Jan 11, 2026
        source: "interview",
      };
    });

    test("shows Confirmed badge and confirmation date", async () => {
      await setup();

      expect(screen.getByText("Confirmed")).toBeInTheDocument();
      expect(screen.getByText("Report Created")).toBeInTheDocument();
      expect(screen.getByText(/jan 11, 2026/i)).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    test("calls mutation on save", async () => {
      mockDefinition = null;
      mockUpdateDefinition.mockResolvedValue("def123");
      const { user } = await setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.type(screen.getByLabelText(/activity name/i), "Project Published");
      await user.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => {
        expect(mockUpdateDefinition).toHaveBeenCalledWith({
          activityName: "Project Published",
          reasoning: "",
          expectedTimeframe: "Within 3 days",
        });
      });
    });

    test("shows validation error for empty activity name", async () => {
      mockDefinition = null;
      const { user } = await setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(screen.getByText(/activity name is required/i)).toBeInTheDocument();
      expect(mockUpdateDefinition).not.toHaveBeenCalled();
    });

    test("cancel closes form without saving", async () => {
      mockDefinition = null;
      const { user } = await setup();

      await user.click(screen.getByRole("button", { name: /define/i }));
      await user.type(screen.getByLabelText(/activity name/i), "Test");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByLabelText(/activity name/i)).not.toBeInTheDocument();
      expect(mockUpdateDefinition).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run all tests to verify**

Run: `npm test -- src/components/profile/FirstValueSection.test.tsx`
Expected: All PASS

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
test(profile): clean up and organize FirstValueSection tests

Consolidate tests into describe blocks for each state (undefined,
defined, confirmed) and form submission behavior. 8 total tests.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Create component with undefined state | 1 |
| 2 | Add defined (pending) state | 1 |
| 3 | Add confirmed state | 1 |
| 4 | Add inline edit form toggle | 2 |
| 5 | Add form submission with mutation | 2 |
| 6 | Clean up and verify tests | 1 |

**Total: 6 tasks, 8 tests**

**Files created:**
- `src/components/profile/FirstValueSection.tsx`
- `src/components/profile/FirstValueSection.test.tsx`

**Verification commands:**
- `npm test -- src/components/profile/FirstValueSection.test.tsx` - Run component tests
- `npm test` - Run full test suite
- `npm run build` - Verify no type errors
