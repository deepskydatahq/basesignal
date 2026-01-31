import { describe, it, expect, vi, beforeEach } from "vitest";
import { withUser, withUserArgs } from "./withUser.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Mock the auth module
vi.mock("./auth.js", () => ({
  resolveUser: vi.fn(),
}));

import { resolveUser } from "./auth.js";

const mockResolveUser = vi.mocked(resolveUser);

const fakeUser = {
  _id: "convex_user_123" as string,
  clerkId: "user_clerk_abc",
  email: "test@example.com",
  name: "Test User",
  image: null,
};

function makeAuthInfo(userId: string): AuthInfo {
  return {
    token: "test-token",
    clientId: "test-client",
    scopes: ["openid"],
    extra: { userId },
  };
}

describe("withUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveUser.mockResolvedValue(fakeUser);
  });

  it("extracts clerkId from authInfo.extra and passes resolved user to handler", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text" as const, text: "ok" }],
    });

    const wrapped = withUser(handler);
    const extra = { authInfo: makeAuthInfo("user_clerk_abc") };
    await wrapped(extra);

    expect(mockResolveUser).toHaveBeenCalledWith("user_clerk_abc");
    expect(handler).toHaveBeenCalledWith(fakeUser, extra);
  });

  it("returns error when authInfo is missing", async () => {
    const handler = vi.fn();
    const wrapped = withUser(handler);

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Authentication required");
    expect(handler).not.toHaveBeenCalled();
    expect(mockResolveUser).not.toHaveBeenCalled();
  });

  it("returns error when authInfo.extra.userId is missing", async () => {
    const handler = vi.fn();
    const wrapped = withUser(handler);

    const authInfo: AuthInfo = {
      token: "test",
      clientId: "test",
      scopes: [],
      extra: {},
    };
    const result = await wrapped({ authInfo });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Authentication required");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withUserArgs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveUser.mockResolvedValue(fakeUser);
  });

  it("passes resolved user, args, and extra to handler", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text" as const, text: "ok" }],
    });

    const wrapped = withUserArgs<{ url: string }>(handler);
    const extra = { authInfo: makeAuthInfo("user_clerk_abc") };
    await wrapped({ url: "https://example.com" }, extra);

    expect(mockResolveUser).toHaveBeenCalledWith("user_clerk_abc");
    expect(handler).toHaveBeenCalledWith(
      fakeUser,
      { url: "https://example.com" },
      extra
    );
  });

  it("returns error when not authenticated", async () => {
    const handler = vi.fn();
    const wrapped = withUserArgs<{ url: string }>(handler);

    const result = await wrapped({ url: "https://example.com" }, {});

    expect(result.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});
