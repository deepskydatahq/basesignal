import { Check, AlertCircle } from "lucide-react";

interface ToolCall {
  name: string;
  arguments: unknown;
  result?: string;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export default function MessageBubble({
  role,
  content,
  toolCalls,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`${
        isUser
          ? "pl-4 border-l-2 border-gray-300"
          : ""
      }`}
    >
      {/* Message content */}
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {content}
      </p>

      {/* Tool calls (for assistant messages) */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {toolCalls.map((tool, i) => (
            <ToolCallBadge key={i} toolCall={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  const isSuccess = toolCall.result?.startsWith("success");
  const Icon = isSuccess ? Check : AlertCircle;

  // Format tool call for display
  const formatToolCall = () => {
    const args = toolCall.arguments as Record<string, unknown>;
    switch (toolCall.name) {
      case "add_stage":
        return `Added stage: ${args.name}`;
      case "add_transition":
        return `Connected: ${args.from_stage} → ${args.to_stage}`;
      case "update_stage":
        return `Updated: ${args.stage}`;
      default:
        return toolCall.name;
    }
  };

  return (
    <div
      className={`flex items-center gap-1 text-xs ${
        isSuccess ? "text-green-700" : "text-red-600"
      }`}
    >
      <Icon className="w-3 h-3" />
      <span>{formatToolCall()}</span>
    </div>
  );
}
