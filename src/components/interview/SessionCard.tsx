import { Check, Loader2 } from "lucide-react";
import { INTERVIEW_TYPES, type InterviewType } from "../../shared/interviewTypes";
import type { Id } from "../../../convex/_generated/dataModel";

interface SessionCardProps {
  session: {
    _id: Id<"interviewSessions">;
    interviewType: string;
    status: string;
    startedAt: number;
    completedAt?: number;
    messageCount: number;
    activitiesAdded: number;
  };
  onClick: () => void;
}

export default function SessionCard({ session, onClick }: SessionCardProps) {
  const typeLabel = INTERVIEW_TYPES[session.interviewType as InterviewType]?.name
    ?? session.interviewType.replace(/_/g, " ");

  const isComplete = session.status === "completed";
  const date = new Date(session.startedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900">{typeLabel}</h3>
        <span className="text-sm text-gray-500">{date}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isComplete ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span>Completed</span>
          </>
        ) : (
          <>
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>In Progress</span>
          </>
        )}
        <span>·</span>
        <span>{session.messageCount} messages</span>
        <span>·</span>
        <span>{session.activitiesAdded} activities</span>
      </div>
    </button>
  );
}
