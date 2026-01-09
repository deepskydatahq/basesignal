import { cn } from "@/lib/utils";

export type MetricCategory = "reach" | "engagement" | "value_delivery" | "value_capture";

const categoryConfig: Record<MetricCategory, { label: string; className: string }> = {
  reach: {
    label: "Reach",
    className: "bg-blue-100 text-blue-700",
  },
  engagement: {
    label: "Engagement",
    className: "bg-green-100 text-green-700",
  },
  value_delivery: {
    label: "Value Delivery",
    className: "bg-purple-100 text-purple-700",
  },
  value_capture: {
    label: "Value Capture",
    className: "bg-orange-100 text-orange-700",
  },
};

interface CategoryBadgeProps {
  category: MetricCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = categoryConfig[category];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
