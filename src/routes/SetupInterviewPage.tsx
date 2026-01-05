import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import OverviewJourneyMap from "../components/overview/OverviewJourneyMap";
import OverviewInterviewPanel from "../components/overview/OverviewInterviewPanel";

export default function SetupInterviewPage() {
  const navigate = useNavigate();
  const user = useQuery(api.users.current);
  const setupProgress = useQuery(api.setupProgress.current);
  const getOrCreateJourney = useMutation(api.journeys.getOrCreateForSetup);
  const updateProgress = useMutation(api.setupProgress.update);

  // Create overview journey if none exists
  useEffect(() => {
    async function ensureJourney() {
      if (!user || !setupProgress) return;
      if (setupProgress.overviewJourneyId) return;

      // Create an overview journey for the setup interview
      const journeyId = await getOrCreateJourney({
        type: "overview",
        name: "Overview Journey",
      });

      await updateProgress({
        overviewJourneyId: journeyId,
      });
    }
    ensureJourney();
  }, [user, setupProgress, getOrCreateJourney, updateProgress]);

  const handleComplete = async () => {
    await updateProgress({
      currentStep: "review_save",
      stepsCompleted: ["overview_interview"],
    });
    navigate("/setup/review");
  };

  // Loading state
  if (!user || !setupProgress) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Waiting for journey creation
  if (!setupProgress.overviewJourneyId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Setting up interview...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Interview chat */}
      <div className="w-1/2 border-r border-gray-200">
        <OverviewInterviewPanel
          journeyId={setupProgress.overviewJourneyId}
          onComplete={handleComplete}
        />
      </div>

      {/* Right: Journey map */}
      <div className="w-1/2 bg-gray-50">
        <OverviewJourneyMap journeyId={setupProgress.overviewJourneyId} />
      </div>
    </div>
  );
}
