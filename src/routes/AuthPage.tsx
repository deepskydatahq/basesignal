import { SignIn, SignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { clerkAppearance } from "../lib/clerkTheme";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-100 items-end p-12">
        <div className="text-2xl font-semibold tracking-tight">Basesignal</div>
      </div>

      {/* Right panel - Auth */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {mode === "signin" ? (
            <SignIn
              appearance={clerkAppearance}
              forceRedirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              forceRedirectUrl="/"
            />
          )}

          <div className="mt-4 text-center text-sm text-neutral-500">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-neutral-900 underline font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-neutral-900 underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
