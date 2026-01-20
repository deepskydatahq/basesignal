import { Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface InterviewCompletionCardProps {
  activityName: string;
  reasoning: string;
  expectedTimeframe: string;
  successCriteria?: string;
  onComplete: () => void;
  isLoading: boolean;
}

export function InterviewCompletionCard({
  activityName,
  reasoning,
  expectedTimeframe,
  successCriteria,
  onComplete,
  isLoading,
}: InterviewCompletionCardProps) {
  return (
    <Card className="border-green-400 bg-green-50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h3 className="font-semibold text-lg">First Value Defined</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-900">{activityName}</p>
            <p className="text-sm text-gray-600">{reasoning}</p>
          </div>

          <div className="text-sm">
            <p>
              <span className="text-gray-500">Timeframe:</span>{" "}
              <span className="text-gray-700">{expectedTimeframe}</span>
            </p>
            {successCriteria && (
              <p>
                <span className="text-gray-500">Success:</span>{" "}
                <span className="text-gray-700">{successCriteria}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onComplete}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            "Saving..."
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Complete Interview
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
