import { cn } from "@/lib/utils";
import { CategoryBadge, type MetricCategory } from "./CategoryBadge";

interface MetricCardProps {
  name: string;
  definition: string;
  category: MetricCategory;
  selected?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  name,
  definition,
  category,
  selected = false,
  onClick,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 bg-white border border-gray-200 rounded-lg",
        "hover:shadow-md transition-shadow cursor-pointer",
        selected && "ring-2 ring-black"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-medium text-gray-900">{name}</h3>
        <CategoryBadge category={category} />
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{definition}</p>
    </button>
  );
}
