import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <Popover>
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
      <PopoverContent>
        {/* Placeholder - will implement expanded state */}
      </PopoverContent>
    </Popover>
  );
}
