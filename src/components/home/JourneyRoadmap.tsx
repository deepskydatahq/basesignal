import { useNavigate } from "react-router-dom";
import { Lock, ChevronDown, Circle } from "lucide-react";
import {
  INTERVIEW_TYPES,
  type InterviewType,
} from "../../../convex/interviewTypes";
import type { Id } from "../../../convex/_generated/dataModel";

type JourneyDefault = {
  _id: Id<"journeys">;
  name: string;
  type: string;
  isDefault: boolean;
} | null;

interface JourneyRoadmapProps {
  defaults: Record<string, JourneyDefault>;
}

type SimpleStatus = "locked" | "available";

const statusStyles: Record<SimpleStatus, { leftBorder: string; text: string }> = {
  locked: { leftBorder: "border-l-gray-200", text: "text-gray-400" },
  available: { leftBorder: "border-l-gray-400", text: "text-gray-900" },
};

// Simple vertical list showing the journey flow
const JOURNEY_ORDER: InterviewType[] = [
  "first_value",
  "retention",
  "value_outcomes",
  "value_capture",
  "churn",
];

export function JourneyRoadmap({ defaults }: JourneyRoadmapProps) {
  const navigate = useNavigate();

  const handleClick = (type: InterviewType) => {
    const journey = defaults[type];
    if (journey) {
      navigate(`/journeys/${journey._id}`);
    } else {
      navigate("/journeys");
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-sm font-medium text-gray-500 mb-4">Journey Progress</h2>

      <div className="space-y-3">
        {JOURNEY_ORDER.map((type, index) => {
          const journey = defaults[type];
          const status: SimpleStatus = journey ? "available" : "locked";

          return (
            <div key={type} className="flex flex-col items-center">
              <JourneyNode
                type={type}
                journeyName={journey?.name}
                status={status}
                onClick={() => handleClick(type)}
              />
              {index < JOURNEY_ORDER.length - 1 && (
                <ChevronDown className="w-4 h-4 text-gray-300 mt-2" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JourneyNode({
  type,
  journeyName,
  status,
  onClick,
}: {
  type: InterviewType;
  journeyName?: string;
  status: SimpleStatus;
  onClick: () => void;
}) {
  const config = INTERVIEW_TYPES[type];
  const styles = statusStyles[status];

  return (
    <button
      onClick={onClick}
      className={`
        w-full max-w-xs p-4 rounded-lg bg-white border border-gray-200 border-l-4 transition-all
        flex items-center justify-between
        ${styles.leftBorder} ${styles.text}
        ${status !== "locked" ? "hover:border-gray-300 cursor-pointer" : "cursor-default"}
      `}
    >
      <div className="text-left">
        <div className="text-[10px] font-medium uppercase tracking-wide opacity-60 mb-0.5">
          {type.replace(/_/g, " ")}
        </div>
        <div className="text-sm font-medium">{journeyName ?? config.name}</div>
      </div>
      <div className="flex-shrink-0 ml-3">
        {status === "locked" && <Lock className="w-4 h-4 opacity-40" />}
        {status === "available" && <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />}
      </div>
    </button>
  );
}
