import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { INTERVIEW_TYPES, type InterviewType } from "../../../convex/interviewTypes";
import InterviewChat from "./InterviewChat";

interface InterviewPanelProps {
  journeyId: Id<"journeys">;
  journeyType: InterviewType;
  isOpen: boolean;
  onToggle: () => void;
}

export default function InterviewPanel({
  journeyId,
  journeyType,
  isOpen,
  onToggle,
}: InterviewPanelProps) {
  const typeStatuses = useQuery(api.interviews.listSessionsWithStatus, { journeyId });
  const createSession = useMutation(api.interviews.createSession);
  const completeSession = useMutation(api.interviews.completeSession);
  const resetSession = useMutation(api.interviews.resetSession);

  // Get session for this journey's type
  const sessionId = typeStatuses?.[journeyType]?.sessionId;
  const status = typeStatuses?.[journeyType]?.status;

  // Auto-create session when panel opens if none exists
  useEffect(() => {
    if (isOpen && typeStatuses && status === "available" && !sessionId) {
      createSession({ journeyId, interviewType: journeyType });
    }
  }, [isOpen, typeStatuses, status, sessionId, journeyId, journeyType, createSession]);

  const handleComplete = async () => {
    if (!sessionId) return;
    await completeSession({ sessionId: sessionId as Id<"interviewSessions"> });
  };

  const handleReset = async () => {
    const confirmed = confirm("This will archive the current conversation and start fresh. Continue?");
    if (!confirmed) return;
    await resetSession({ journeyId, interviewType: journeyType });
  };

  // Get type label for header
  const typeLabel = INTERVIEW_TYPES[journeyType]?.name ?? journeyType.replace(/_/g, " ");

  // Collapsed state
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-4 top-4 z-10 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm">{typeLabel}</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="w-1/2 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h2 className="font-medium text-gray-900">{typeLabel}</h2>
        </div>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      {sessionId ? (
        <InterviewChat
          type={journeyType}
          sessionId={sessionId as Id<"interviewSessions">}
          isComplete={status === "complete"}
          onBack={onToggle}
          onComplete={handleComplete}
          onReset={handleReset}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Starting interview...</div>
        </div>
      )}
    </div>
  );
}
