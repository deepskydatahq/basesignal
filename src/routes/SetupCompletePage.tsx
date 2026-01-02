import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SetupCompletionScreen } from "../components/setup/SetupCompletionScreen";

export default function SetupCompletePage() {
  const user = useQuery(api.users.current);
  const progress = useQuery(api.setupProgress.current);
  const updateProgress = useMutation(api.setupProgress.update);

  // Mark setup as complete when reaching this page
  useEffect(() => {
    if (progress && progress.status !== "completed") {
      updateProgress({
        status: "completed",
        stepsCompleted: ["overview_interview", "review_save"],
      });
    }
  }, [progress, updateProgress]);

  return <SetupCompletionScreen productName={user?.productName} />;
}
