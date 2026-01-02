import type { ReactNode } from "react";

interface OnboardingLayoutProps {
  children: ReactNode;
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Dimmed app preview behind */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="h-14 border-b bg-white" />
        <div className="flex">
          <div className="w-64 h-screen border-r bg-white" />
          <div className="flex-1 p-8">
            <div className="h-64 rounded-lg border-2 border-dashed border-neutral-200" />
          </div>
        </div>
      </div>

      {/* Onboarding content on top */}
      {children}
    </div>
  );
}
