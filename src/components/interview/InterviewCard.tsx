import { Lock, Check, Circle, Loader2 } from "lucide-react";
import { INTERVIEW_TYPES, type InterviewType, type InterviewStatus } from "../../../convex/interviewTypes";

interface InterviewCardProps {
  type: InterviewType;
  status: InterviewStatus;
  missingDeps?: string[];
  onSelect: () => void;
  isSelected: boolean;
}

export default function InterviewCard({
  type,
  status,
  missingDeps = [],
  onSelect,
  isSelected,
}: InterviewCardProps) {
  const config = INTERVIEW_TYPES[type];

  const statusIcon = {
    locked: <Lock className="w-4 h-4 text-gray-400" />,
    available: <Circle className="w-4 h-4 text-gray-400" />,
    in_progress: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    complete: <Check className="w-4 h-4 text-green-500" />,
  }[status];

  const statusStyles = {
    locked: "opacity-50 cursor-not-allowed",
    available: "cursor-pointer hover:border-blue-300 hover:bg-blue-50",
    in_progress: "cursor-pointer border-blue-500 bg-blue-50",
    complete: "cursor-pointer hover:border-green-300",
  }[status];

  const handleClick = () => {
    if (status !== "locked") {
      onSelect();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`p-3 border rounded-lg transition-colors ${statusStyles} ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm">{config.name}</h3>
          {status === "locked" ? (
            <p className="text-xs text-gray-400 mt-0.5">
              Needs: {missingDeps.map(d => INTERVIEW_TYPES[d as InterviewType]?.name).join(", ")}
            </p>
          ) : status === "in_progress" ? (
            <p className="text-xs text-blue-600 mt-0.5">Continue conversation...</p>
          ) : status === "complete" ? (
            <p className="text-xs text-green-600 mt-0.5">Completed</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
