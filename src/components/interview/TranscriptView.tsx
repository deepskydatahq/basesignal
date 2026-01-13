import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { INTERVIEW_TYPES, type InterviewType } from "../../shared/interviewTypes";
import { ScrollArea } from "../ui/scroll-area";

interface TranscriptViewProps {
  sessionId: Id<"interviewSessions">;
  interviewType: string;
  date: number;
  onBack: () => void;
}

export default function TranscriptView({
  sessionId,
  interviewType,
  date,
  onBack,
}: TranscriptViewProps) {
  const transcript = useQuery(api.interviews.getTranscript, { sessionId });
  const typeLabel = INTERVIEW_TYPES[interviewType as InterviewType]?.name
    ?? interviewType.replace(/_/g, " ");
  const dateStr = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1 text-gray-400 hover:text-gray-600"
          aria-label="Back to session list"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-medium text-gray-900">{typeLabel}</h2>
          <p className="text-sm text-gray-500">{dateStr}</p>
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1 p-4">
        {transcript === undefined ? (
          <div className="text-gray-500 text-sm">Loading transcript...</div>
        ) : transcript.length === 0 ? (
          <div className="text-gray-500 text-sm">No messages in this session.</div>
        ) : (
          <div className="space-y-6">
            {transcript.map((message, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {message.role === "assistant" ? "ASSISTANT" : "YOU"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.toolCalls.map((tc, tcIndex) => (
                        <span
                          key={tcIndex}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded"
                        >
                          Added: {tc.arguments?.name || tc.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
