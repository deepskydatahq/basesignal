import { createClerkClient } from "@clerk/backend";

export function createClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }
  return createClerkClient({ secretKey });
}

export async function findClerkUserByEmail(email: string): Promise<string | null> {
  const clerk = createClerk();
  const users = await clerk.users.getUserList({
    emailAddress: [email],
  });

  if (users.data.length === 0) {
    return null;
  }

  return users.data[0].id;
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const clerk = createClerk();
  await clerk.users.deleteUser(clerkUserId);
}
