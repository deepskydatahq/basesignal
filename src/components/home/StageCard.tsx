import { Users, Target, FileText, BarChart3, Check, Lock, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = {
  Users,
  Target,
  FileText,
  BarChart3,
} as const;

type IconName = keyof typeof ICONS;

export type StageStatus = "not_started" | "in_progress" | "complete" | "not_defined" | "defined" | "locked";

interface StageCardProps {
  title: string;
  description: string;
  icon: IconName;
  status: StageStatus;
  progressText?: string;
  onClick?: () => void;
}

const STATUS_CONFIG: Record<
  StageStatus,
  {
    badge: React.ReactNode;
    buttonLabel: string | null;
    buttonVariant: "default" | "secondary" | "outline";
    opacity: string;
  }
> = {
  not_started: {
    badge: <Circle className="w-4 h-4 text-gray-300" />,
    buttonLabel: "Start",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  in_progress: {
    badge: <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />,
    buttonLabel: "Continue",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  complete: {
    badge: <Check className="w-4 h-4 text-green-600" />,
    buttonLabel: "View",
    buttonVariant: "secondary",
    opacity: "opacity-100",
  },
  not_defined: {
    badge: <Circle className="w-4 h-4 text-gray-300" />,
    buttonLabel: "Define",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  defined: {
    badge: <Check className="w-4 h-4 text-green-600" />,
    buttonLabel: "View",
    buttonVariant: "secondary",
    opacity: "opacity-100",
  },
  locked: {
    badge: <Lock className="w-4 h-4 text-gray-300" />,
    buttonLabel: null,
    buttonVariant: "outline",
    opacity: "opacity-40",
  },
};

export function StageCard({
  title,
  description,
  icon,
  status,
  progressText,
  onClick,
}: StageCardProps) {
  const Icon = ICONS[icon];
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  return (
    <div
      className={cn(
        "flex flex-col p-4 rounded-lg border border-gray-200 bg-white",
        config.opacity,
        !isLocked && "hover:border-gray-300 transition-colors"
      )}
    >
      {/* Header row: icon + badge */}
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 text-gray-600" />
        {config.badge}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 flex-1">{description}</p>

      {/* Progress text (if provided) */}
      {progressText && (
        <p className="text-xs text-blue-600 mb-2">{progressText}</p>
      )}

      {/* CTA or locked text */}
      {isLocked ? (
        <span className="text-xs text-gray-400">Coming soon</span>
      ) : (
        <Button
          size="sm"
          variant={config.buttonVariant}
          onClick={onClick}
          className="w-full"
        >
          {config.buttonLabel}
        </Button>
      )}
    </div>
  );
}
