import { Button } from "@/components/ui/button";

const TIMEFRAME_OPTIONS = [
  { value: "Within first session", label: "First session" },
  { value: "Within 24 hours", label: "24 hours" },
  { value: "Within first week", label: "First week" },
  { value: "custom", label: "Other" },
];

interface TimeframeQuickSelectProps {
  selected?: string;
  onSelect: (value: string) => void;
}

export function TimeframeQuickSelect({
  selected,
  onSelect,
}: TimeframeQuickSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={selected === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(option.value)}
          aria-pressed={selected === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
