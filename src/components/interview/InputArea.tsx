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
    <div className="px-6 py-4 border-t border-gray-200">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
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
          rows={2}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading}
          className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed self-end"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
