import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  sessionId: Id<"interviewSessions">;
}

export default function MessageList({ sessionId }: MessageListProps) {
  const messages = useQuery(api.interviews.getMessages, { sessionId });
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-gray-400 text-center">
          <p>Starting interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message._id}
          role={message.role as "user" | "assistant"}
          content={message.content}
          toolCalls={message.toolCalls}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
