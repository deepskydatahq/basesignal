import { History } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";

interface InterviewHistoryButtonProps {
  journeyId: Id<"journeys">;
  onClick: () => void;
}

export default function InterviewHistoryButton({
  journeyId,
  onClick,
}: InterviewHistoryButtonProps) {
  const history = useQuery(api.interviews.getSessionHistory, { journeyId });
  const count = history?.length ?? 0;

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <History className="w-4 h-4 mr-1" />
      History
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
          {count}
        </span>
      )}
    </Button>
  );
}
