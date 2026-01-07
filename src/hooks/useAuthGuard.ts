import { useAuth, useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback } from "react";

export type SetupStatus = "not_started" | "in_progress" | "complete" | undefined;

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry if it's not an auth error
      if (!lastError.message.includes("Not authenticated")) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export function useAuthGuard() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user: clerkUser } = useUser();

  // Skip query until signed in (prevents race condition with JWT propagation)
  const user = useQuery(api.users.current, isSignedIn ? {} : "skip");

  const setupProgress = useQuery(
    api.setupProgress.current,
    isSignedIn ? {} : "skip"
  );
  const createOrGetUser = useMutation(api.users.createOrGetUser);

  // Track if we've already attempted user creation
  const creationAttemptedRef = useRef(false);

  // Create user with retry logic
  const createUserWithRetry = useCallback(async () => {
    if (creationAttemptedRef.current) return;
    creationAttemptedRef.current = true;

    try {
      await retryWithBackoff(() => createOrGetUser());
    } catch (err) {
      console.error("Failed to create user after retries:", err);
      // Reset so user can retry on next sign-in
      creationAttemptedRef.current = false;
    }
  }, [createOrGetUser]);

  // Create user in Convex on first sign-in (fallback if webhook missed)
  useEffect(() => {
    if (isSignedIn && authLoaded && user === null) {
      createUserWithRetry();
    }
  }, [isSignedIn, authLoaded, user, createUserWithRetry]);

  // Reset creation attempted flag when signing out
  useEffect(() => {
    if (!isSignedIn) {
      creationAttemptedRef.current = false;
    }
  }, [isSignedIn]);

  // Derive setup status from user record
  const setupStatus: SetupStatus = user?.setupStatus as SetupStatus;

  // For backwards compatibility during migration
  const needsOnboarding = user && user.onboardingComplete === false && !setupStatus;
  const needsSetup = setupStatus === "not_started" || setupStatus === undefined;
  const setupInProgress = setupStatus === "in_progress";
  const setupComplete = setupStatus === "complete";

  return {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !authLoaded || (isSignedIn && user === undefined),
    user,
    clerkUser,
    // Legacy (for migration)
    needsOnboarding,
    // New setup mode
    setupStatus,
    setupProgress,
    needsSetup,
    setupInProgress,
    setupComplete,
  };
}
