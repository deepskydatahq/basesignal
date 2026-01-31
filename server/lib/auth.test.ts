import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveUser, clearUserCache } from "./auth.js";

// Mock the convex module
vi.mock("./convex.js", () => ({
  getConvexClient: vi.fn(),
}));

// Mock the Convex API (just needs to be a reference the mock can match)
vi.mock("../../convex/_generated/api.js", () => ({
  api: {
    users: {
      getOrCreateByClerkId: "users:getOrCreateByClerkId",
    },
  },
}));

import { getConvexClient } from "./convex.js";

const mockGetConvexClient = vi.mocked(getConvexClient);

const fakeUser = {
  _id: "convex_user_456",
  clerkId: "user_clerk_xyz",
  email: "resolved@example.com",
  name: "Resolved User",
  image: null,
};

describe("resolveUser", () => {
  let mockMutation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearUserCache();
    mockMutation = vi.fn().mockResolvedValue(fakeUser);
    mockGetConvexClient.mockReturnValue({ mutation: mockMutation } as any);
  });

  it("calls Convex getOrCreateByClerkId and returns user", async () => {
    const user = await resolveUser("user_clerk_xyz", {
      email: "resolved@example.com",
      name: "Resolved User",
    });

    expect(mockMutation).toHaveBeenCalledWith(
      "users:getOrCreateByClerkId",
      {
        clerkId: "user_clerk_xyz",
        email: "resolved@example.com",
        name: "Resolved User",
        image: undefined,
      }
    );
    expect(user).toEqual(fakeUser);
  });

  it("caches results and does not call Convex again for same clerkId", async () => {
    await resolveUser("user_clerk_xyz");
    await resolveUser("user_clerk_xyz");

    expect(mockMutation).toHaveBeenCalledTimes(1);
  });

  it("calls Convex separately for different clerkIds", async () => {
    const fakeUser2 = { ...fakeUser, _id: "convex_user_789", clerkId: "user_clerk_other" };
    mockMutation
      .mockResolvedValueOnce(fakeUser)
      .mockResolvedValueOnce(fakeUser2);

    await resolveUser("user_clerk_xyz");
    await resolveUser("user_clerk_other");

    expect(mockMutation).toHaveBeenCalledTimes(2);
  });

  it("clearUserCache resets the cache", async () => {
    await resolveUser("user_clerk_xyz");
    clearUserCache();
    await resolveUser("user_clerk_xyz");

    expect(mockMutation).toHaveBeenCalledTimes(2);
  });
});
