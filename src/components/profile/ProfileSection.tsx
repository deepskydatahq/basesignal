import { Check, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProfileSectionStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | "locked";

interface ProfileSectionProps {
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
  timeEstimate?: string;
}

const STATUS_CONFIG: Record<
  ProfileSectionStatus,
  {
    icon: React.ReactNode;
    badgeClass: string;
  }
> = {
  complete: {
    icon: <Check className="w-4 h-4" />,
    badgeClass: "text-green-700",
  },
  in_progress: {
    icon: <Circle className="w-4 h-4 fill-current" />,
    badgeClass: "text-blue-600",
  },
  not_started: {
    icon: <Circle className="w-4 h-4" />,
    badgeClass: "text-gray-500",
  },
  locked: {
    icon: <Lock className="w-4 h-4" />,
    badgeClass: "text-gray-400",
  },
};

export function ProfileSection({
  title,
  status,
  statusLabel,
  children,
  actionLabel,
  onAction,
  prerequisiteText,
  timeEstimate,
}: ProfileSectionProps) {
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-6 mb-6",
        isLocked
          ? "border-dashed border-gray-300 opacity-50"
          : "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            config.badgeClass
          )}
        >
          <span>{statusLabel}</span>
          {config.icon}
        </div>
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Content */}
      <div className="mb-4">{children}</div>

      {/* Action */}
      {actionLabel && (
        <div className="flex justify-end items-center gap-2">
          {isLocked && prerequisiteText && (
            <span className="text-xs text-gray-400">{prerequisiteText}</span>
          )}
          {!isLocked && timeEstimate && (
            <span className="text-xs text-gray-400">{timeEstimate}</span>
          )}
          <Button
            variant={isLocked ? "outline" : "secondary"}
            onClick={onAction}
            disabled={isLocked}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
