import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Send, Loader2 } from "lucide-react";

interface InputAreaProps {
  sessionId: Id<"interviewSessions">;
}

export default function InputArea({ sessionId }: InputAreaProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chat = useAction(api.ai.chat);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setMessage("");
    setIsLoading(true);

    try {
      await chat({ sessionId, message: trimmed });
    } catch (error) {
      console.error("Chat error:", error);
      // Could add toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-gray-200">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Thinking...</span>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your journey..."
          disabled={isLoading}
          rows={1}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
