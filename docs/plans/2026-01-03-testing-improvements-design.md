# Testing Improvements Design

**Date:** 2026-01-03
**Status:** Approved
**Approach:** Infrastructure-First (Tooling → Audit → Skill → E2E)

## Overview

Improve testing infrastructure and practices following Kent C. Dodds' methodology. The goal is to establish patterns that maximize confidence while minimizing maintenance burden.

## Current State

- **Tooling:** Vitest + React Testing Library + jest-dom + user-event
- **Tests:** 4 files, 29 passing tests
  - `sanity.test.ts` - setup verification
  - `validation.test.ts` - unit tests for pure functions
  - `PhilosophyScreen.test.tsx` - component tests
  - `BriefingScreen.test.tsx` - component tests with mocked Convex

**Issues identified:**
- Mocking Convex with `vi.mock` instead of proper backend testing
- Small isolated tests vs. longer workflow tests
- Using `beforeEach` with shared state vs. setup functions
- No ESLint plugins for testing best practices
- No Convex function tests
- No E2E test for critical path

## Design

### 1. ESLint Plugin Setup

Install and configure testing-specific ESLint rules:

```bash
npm install -D eslint-plugin-testing-library eslint-plugin-jest-dom
```

**Rules to enable:**
- `testing-library/prefer-screen-queries` - enforce `screen.getBy*`
- `testing-library/prefer-user-event` - prefer over `fireEvent`
- `testing-library/no-container` - no `container.querySelector`
- `testing-library/prefer-find-by` - use `find*` for async
- `jest-dom/prefer-in-document` - use `.toBeInTheDocument()`

### 2. Convex Testing with convex-test

Two testing layers:

| Layer | Tool | What it tests |
|-------|------|---------------|
| **Convex functions** | `convex-test` | Queries, mutations, actions directly |
| **React components** | RTL + mocked hooks | Component rendering and interactions |

```bash
npm install -D convex-test @edge-runtime/vm
```

**Example Convex function test:**

```typescript
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

test("create journey sets first as default", async () => {
  const t = convexTest(schema);
  const asUser = t.withIdentity({ subject: "user_123" });

  const id = await asUser.mutation(api.journeys.create, {
    type: "overview",
    name: "My First Journey",
  });

  const journey = await asUser.query(api.journeys.get, { id });
  expect(journey?.isDefault).toBe(true);
});
```

### 3. Test Structure Patterns

**Replace nested `beforeEach` with setup functions:**

```typescript
function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();
  render(<Component {...defaultProps} {...props} />);

  return {
    user,
    getSubmitButton: () => screen.getByRole("button", { name: /submit/i }),
  };
}
```

**Write fewer, longer workflow tests:**

```typescript
test("briefing screen shows preparation checklist and outputs", () => {
  const { getStartButton } = setup({ productName: "Acme" });

  expect(screen.getByText(/we don't track clicks/i)).toBeInTheDocument();
  expect(screen.getByText(/Acme's user journey/i)).toBeInTheDocument();
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();
  expect(getStartButton()).toBeEnabled();
});
```

### 4. Audit Plan

| File | Changes Needed |
|------|----------------|
| `sanity.test.ts` | Keep or delete (served its purpose) |
| `validation.test.ts` | Minor: flatten nested `describe` |
| `PhilosophyScreen.test.tsx` | Consolidate to 2 workflow tests, add setup function |
| `BriefingScreen.test.tsx` | Consolidate to 2 tests, replace with setup function |

**New test files:**
- `convex/journeys.test.ts` - Test journey CRUD
- `convex/overviewInterview.test.ts` - Test activity validation, duplicates

### 5. Testing Skill

Create `.claude/skills/testing.md` with:
- Testing Trophy guidelines (what to test where)
- Query priority (getByRole first)
- Setup function pattern
- Workflow test examples
- Convex function test examples
- Pre-commit checklist

### 6. Playwright E2E

One critical path test covering:
1. Land on home
2. Complete onboarding screens
3. Start overview interview
4. AI suggests activities
5. Verify activity added to journey map

```bash
npm init playwright@latest
```

## Implementation Order

1. [ ] Add ESLint plugins and configure rules
2. [ ] Set up `convex-test` and update vitest config
3. [ ] Audit and refactor existing 4 test files
4. [ ] Add Convex function tests (journeys, overviewInterview)
5. [ ] Create testing skill (`.claude/skills/testing.md`)
6. [ ] Update CLAUDE.md to reference testing skill
7. [ ] Set up Playwright and write critical path E2E test

## Testing Trophy Reference

| Layer | Tool | When to use |
|-------|------|-------------|
| **Static** | TypeScript, ESLint | Always on |
| **Unit** | Vitest | Pure functions (validation.ts) |
| **Integration** | convex-test, RTL | Business logic, components |
| **E2E** | Playwright | Critical user paths |

Focus most effort on **integration tests** - they provide the best confidence-to-cost ratio.
