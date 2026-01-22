import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

function getStatusLabel(completed: number): { label: string; className: string } {
  if (completed >= 10) {
    return { label: "Complete", className: "bg-green-100 text-green-800" };
  }
  if (completed >= 7) {
    return { label: "Well Defined", className: "bg-amber-100 text-amber-800" };
  }
  if (completed >= 4) {
    return { label: "Taking Shape", className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Getting Started", className: "bg-gray-100 text-gray-800" };
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const [open, setOpen] = useState(false);
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);
  const status = getStatusLabel(completed);
  const firstIncomplete = sections.find((s) => !s.isComplete);

  const handleCTAClick = () => {
    if (firstIncomplete) {
      const element = document.getElementById(`section-${firstIncomplete.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-black rounded-full transition-[width] duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completed} of {total}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <Badge className={status.className}>{status.label}</Badge>

          <ul className="space-y-2">
            {sections.map((section) => (
              <li
                key={section.id}
                data-complete={section.isComplete}
                className="flex items-center gap-2 text-sm"
              >
                {section.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className={section.isComplete ? "text-gray-900" : "text-gray-500"}>
                  {section.label}
                </span>
              </li>
            ))}
          </ul>

          {firstIncomplete && (
            <Button onClick={handleCTAClick} className="w-full">
              Complete {firstIncomplete.label}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
