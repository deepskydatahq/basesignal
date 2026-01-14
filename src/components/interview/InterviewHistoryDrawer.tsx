import { useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ScrollArea } from "../ui/scroll-area";
import SessionCard from "./SessionCard";
import TranscriptView from "./TranscriptView";

interface InterviewHistoryDrawerProps {
  journeyId: Id<"journeys">;
  isOpen: boolean;
  onClose: () => void;
}

export default function InterviewHistoryDrawer({
  journeyId,
  isOpen,
  onClose,
}: InterviewHistoryDrawerProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"interviewSessions"> | null>(null);
  const history = useQuery(api.interviews.getSessionHistory, { journeyId });

  if (!isOpen) return null;

  const selectedSession = history?.find((s) => s._id === selectedSessionId);

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {selectedSession ? (
        <TranscriptView
          sessionId={selectedSession._id}
          interviewType={selectedSession.interviewType ?? "unknown"}
          date={selectedSession.startedAt}
          onBack={() => setSelectedSessionId(null)}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-medium text-gray-900">Interview History</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1 p-4">
            {history === undefined ? (
              <div className="text-gray-500 text-sm">Loading sessions...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No interview sessions yet</p>
                <p className="text-sm text-gray-400">
                  Start an interview from the panel on the left to begin building your journey map.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={{
                      ...session,
                      interviewType: session.interviewType ?? "unknown",
                    }}
                    onClick={() => setSelectedSessionId(session._id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
