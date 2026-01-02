import type { ReactNode } from "react";

interface OnboardingModalProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  size?: "default" | "medium" | "wide";
}

const SIZE_CLASSES = {
  default: "max-w-sm",
  medium: "max-w-md",
  wide: "max-w-2xl",
} as const;

export function OnboardingModal({
  children,
  currentStep,
  totalSteps,
  size = "default",
}: OnboardingModalProps) {
  const widthClass = SIZE_CLASSES[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-lg shadow-xl ${widthClass} w-full mx-4 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300`}
      >
        {children}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep ? "w-2.5 h-2.5 bg-black" : "w-2 h-2 bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
