import { Outlet } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SetupModeHeader } from "../components/setup/SetupModeHeader";

export default function SetupLayout() {
  const progress = useQuery(api.setupProgress.current);

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SetupModeHeader
        currentStep={progress.currentStep}
        stepsCompleted={progress.stepsCompleted}
      />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
