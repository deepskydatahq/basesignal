import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ICPProfile } from "../../../convex/analysis/outputs/types";

interface ICPProfilesSectionProps {
  profiles: ICPProfile[];
}

function confidenceLabel(confidence: number): string {
  if (confidence > 0.8) return "High";
  if (confidence > 0.6) return "Medium";
  return "Low";
}

function confidenceClassName(confidence: number): string {
  if (confidence > 0.8) return "bg-green-100 text-green-800";
  if (confidence > 0.6) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-800";
}

export function ICPProfilesSection({ profiles }: ICPProfilesSectionProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        No ICP profiles generated yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {profiles.map((profile) => (
        <Card key={profile.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{profile.name}</CardTitle>
              <Badge
                className={confidenceClassName(profile.confidence)}
              >
                {confidenceLabel(profile.confidence)}{" "}
                {Math.round(profile.confidence * 100)}%
              </Badge>
            </div>
            <CardDescription>{profile.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.value_moment_priorities.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">
                  Value Moment Priorities
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {profile.value_moment_priorities.map((vmp) => (
                    <li key={vmp.moment_id}>
                      <span className="font-medium">P{vmp.priority}</span>{" "}
                      {vmp.relevance_reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <CollapsibleSection
              label="Activation Triggers"
              items={profile.activation_triggers}
              isOpen={!!openSections[`${profile.id}-triggers`]}
              onToggle={() => toggle(`${profile.id}-triggers`)}
            />
            <CollapsibleSection
              label="Pain Points"
              items={profile.pain_points}
              isOpen={!!openSections[`${profile.id}-painPoints`]}
              onToggle={() => toggle(`${profile.id}-painPoints`)}
            />
            <CollapsibleSection
              label="Success Metrics"
              items={profile.success_metrics}
              isOpen={!!openSections[`${profile.id}-metrics`]}
              onToggle={() => toggle(`${profile.id}-metrics`)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CollapsibleSection({
  label,
  items,
  isOpen,
  onToggle,
}: {
  label: string;
  items: string[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {label} ({items.length})
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1 space-y-1 text-sm text-gray-600">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
