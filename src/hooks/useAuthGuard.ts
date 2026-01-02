import { useAuth, useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export type SetupStatus = "not_started" | "in_progress" | "complete" | undefined;

export function useAuthGuard() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const user = useQuery(api.users.current);
  const setupProgress = useQuery(
    api.setupProgress.current,
    isSignedIn ? {} : "skip"
  );
  const createOrGetUser = useMutation(api.users.createOrGetUser);

  // Create user in Convex on first sign-in
  useEffect(() => {
    if (isSignedIn && authLoaded && user === null) {
      createOrGetUser().catch(console.error);
    }
  }, [isSignedIn, authLoaded, user, createOrGetUser]);

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
