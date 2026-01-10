import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FirstValueCandidateCardProps {
  activityName: string;
  reasoning: string;
  onConfirm: () => void;
  onKeepExploring: () => void;
}

export function FirstValueCandidateCard({
  activityName,
  reasoning,
  onConfirm,
  onKeepExploring,
}: FirstValueCandidateCardProps) {
  return (
    <div className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Star
          className="w-5 h-5 text-yellow-500 fill-yellow-500"
          data-testid="star-icon"
        />
        <span className="font-semibold text-gray-900">{activityName}</span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{reasoning}</p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onKeepExploring}>
          Keep Exploring
        </Button>
        <Button onClick={onConfirm}>
          Confirm First Value
        </Button>
      </div>
    </div>
  );
}
