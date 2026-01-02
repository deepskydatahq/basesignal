import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Check, Circle } from "lucide-react";

interface SetupResumeScreenProps {
  userName?: string;
  currentStep: string;
  stepsCompleted: string[];
}

const STEPS = [
  { id: "overview_interview", label: "Overview Interview" },
  { id: "review_save", label: "Review & Save" },
];

export function SetupResumeScreen({
  userName,
  currentStep,
  stepsCompleted,
}: SetupResumeScreenProps) {
  const navigate = useNavigate();
  const resumeSetup = useMutation(api.setupProgress.resume);

  const stepsRemaining = STEPS.length - stepsCompleted.length;

  const handleContinue = async () => {
    await resumeSetup();
    // Navigate to the appropriate step
    if (currentStep === "overview_interview") {
      navigate("/setup/interview");
    } else if (currentStep === "review_save") {
      navigate("/setup/review");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-gray-600 mb-8">
          You're {stepsRemaining} step{stepsRemaining !== 1 ? "s" : ""} away from your foundation
        </p>

        {/* Progress visualization */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const isCompleted = stepsCompleted.includes(step.id);
            const isCurrent = step.id === currentStep;

            return (
              <div key={step.id} className="flex items-center">
                {index > 0 && (
                  <div
                    className={`w-12 h-0.5 ${
                      isCompleted ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-amber-500 text-white"
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1 ${
                      isCompleted || isCurrent ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          Continue Setup
        </Button>
      </div>
    </div>
  );
}
