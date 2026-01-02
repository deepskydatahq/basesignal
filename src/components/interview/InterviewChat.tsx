import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { INTERVIEW_TYPES, type InterviewType } from "../../../convex/interviewTypes";
import MessageList from "./MessageList";
import InputArea from "./InputArea";

interface InterviewChatProps {
  type: InterviewType;
  sessionId: Id<"interviewSessions">;
  isComplete: boolean;
  onBack: () => void;
  onComplete: () => void;
  onReset: () => void;
}

export default function InterviewChat({
  type,
  sessionId,
  isComplete,
  onBack,
  onComplete,
  onReset,
}: InterviewChatProps) {
  const config = INTERVIEW_TYPES[type];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="font-medium text-gray-900 text-sm">{config.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          {isComplete ? (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Reset and start fresh"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Mark this interview as complete"
            >
              <Check className="w-3 h-3" />
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageList sessionId={sessionId} />

      {/* Input (only if not complete) */}
      {!isComplete && <InputArea sessionId={sessionId} />}
    </div>
  );
}
