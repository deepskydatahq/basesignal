import { SignIn, SignUp } from "@clerk/clerk-react";
import { useState } from "react";

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
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none w-full",
                  headerTitle: "text-2xl font-semibold",
                  headerSubtitle: "text-neutral-500",
                  socialButtonsBlockButton: "h-12 text-base",
                  formFieldInput: "h-12",
                  formButtonPrimary: "h-12 text-base bg-neutral-900 hover:bg-neutral-800",
                  footerAction: "hidden",
                },
              }}
              forceRedirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none w-full",
                  headerTitle: "text-2xl font-semibold",
                  headerSubtitle: "text-neutral-500",
                  socialButtonsBlockButton: "h-12 text-base",
                  formFieldInput: "h-12",
                  formButtonPrimary: "h-12 text-base bg-neutral-900 hover:bg-neutral-800",
                  footerAction: "hidden",
                },
              }}
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
