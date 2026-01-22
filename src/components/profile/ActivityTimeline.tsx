import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline() {
  const [isOpen, setIsOpen] = useState(false);
  const activities = useQuery(api.activity.getRecentActivity);

  if (!activities?.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full text-left">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-4 space-y-3">
            {activities.map((activity, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-gray-400 shrink-0">{formatDate(activity.timestamp)}</span>
                <span className="text-gray-700">{activity.description}</span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
