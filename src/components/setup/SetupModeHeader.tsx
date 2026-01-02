import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";

interface SetupModeHeaderProps {
  currentStep: string;
  stepsCompleted: string[];
}

const STEPS = [
  { id: "overview_interview", label: "Overview Interview" },
  { id: "review_save", label: "Review & Save" },
];

export function SetupModeHeader({ currentStep, stepsCompleted }: SetupModeHeaderProps) {
  const pauseSetup = useMutation(api.setupProgress.pause);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const currentStepLabel = STEPS[currentStepIndex]?.label ?? currentStep;
  const completedCount = stepsCompleted.length;
  const totalSteps = STEPS.length;

  const handleSaveAndExit = async () => {
    await pauseSetup();
    // The app will detect paused status and show resume screen
    window.location.reload();
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-800 font-medium text-sm">Setup Mode</span>
          <span className="text-amber-600 text-sm">
            Step {completedCount + 1} of {totalSteps}
          </span>
          <span className="text-amber-600 text-sm">•</span>
          <span className="text-amber-700 text-sm font-medium">{currentStepLabel}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSaveAndExit}
        className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
      >
        Save & Exit
      </Button>
    </div>
  );
}
