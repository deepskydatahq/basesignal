import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import MessageList from "../interview/MessageList";
import InputArea from "../interview/InputArea";

interface OverviewInterviewPanelProps {
  journeyId: Id<"journeys">;
  onComplete: () => void;
}

export default function OverviewInterviewPanel({
  journeyId,
  onComplete,
}: OverviewInterviewPanelProps) {
  const createSession = useMutation(api.interviews.createSession);
  const completeSession = useMutation(api.interviews.completeSession);
  const activeSession = useQuery(api.interviews.getActiveSession, {
    journeyId,
    interviewType: "overview",
  });
  const completionStatus = useQuery(api.overviewInterview.checkCompletionStatus, { journeyId });

  // Auto-create session if none exists
  useEffect(() => {
    if (activeSession === null) {
      createSession({ journeyId, interviewType: "overview" });
    }
  }, [activeSession, journeyId, createSession]);

  const handleComplete = async () => {
    if (!activeSession) return;
    await completeSession({ sessionId: activeSession._id });
    onComplete();
  };

  const canComplete = completionStatus?.canComplete ?? false;

  if (activeSession === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Starting interview...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Headline */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Define your user lifecycle
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Tell us how users move through your product
        </p>
      </div>

      {/* Messages */}
      <MessageList sessionId={activeSession._id} />

      {/* Input */}
      <InputArea sessionId={activeSession._id} />

      {/* Complete button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleComplete}
          disabled={!canComplete}
          className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
            canComplete
              ? "bg-black text-white hover:bg-gray-800"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {canComplete ? "Complete Interview" : "Complete Interview"}
        </button>
        {!canComplete && completionStatus?.missingRequired && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Fill in {completionStatus.missingRequired.length} more required{" "}
            {completionStatus.missingRequired.length === 1 ? "stage" : "stages"}
          </p>
        )}
      </div>
    </div>
  );
}
