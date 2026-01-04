import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateDevEnvironment } from "./safety";

describe("validateDevEnvironment", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if CONVEX_URL looks like production", () => {
    process.env.VITE_CONVEX_URL = "https://prod-deployment.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).toThrow("production");
  });

  it("throws if CLERK_SECRET_KEY is live key", () => {
    process.env.VITE_CONVEX_URL = "https://dev-deployment.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_live_xxx";

    expect(() => validateDevEnvironment()).toThrow("production Clerk");
  });

  it("passes for dev Convex URL and test Clerk key", () => {
    process.env.VITE_CONVEX_URL = "https://woozy-kangaroo-701.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).not.toThrow();
  });

  it("passes for localhost Convex URL", () => {
    process.env.VITE_CONVEX_URL = "http://localhost:3210";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).not.toThrow();
  });
});
