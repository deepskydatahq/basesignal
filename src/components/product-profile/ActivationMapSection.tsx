import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActivationMap, ActivationStage } from "./types";

const SIGNAL_COLORS: Record<string, string> = {
  very_strong: "bg-indigo-100 text-indigo-800",
  strong: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  weak: "bg-gray-100 text-gray-800",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

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

function StageCard({
  stage,
  isPrimary,
  openSections,
  onToggle,
}: {
  stage: ActivationStage;
  isPrimary: boolean;
  openSections: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <Card
      data-testid="stage-card"
      className={
        isPrimary ? "ring-2 ring-indigo-500 border-indigo-300" : undefined
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-gray-100 text-gray-800">L{stage.level}</Badge>
            <span className="text-base font-medium text-gray-900">
              {stage.name}
            </span>
          </div>
          <Badge
            className={
              SIGNAL_COLORS[stage.signal_strength] ?? SIGNAL_COLORS.medium
            }
          >
            {stage.signal_strength}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CollapsibleSection
          label="Trigger Events"
          items={stage.trigger_events}
          isOpen={!!openSections[`${stage.level}-triggers`]}
          onToggle={() => onToggle(`${stage.level}-triggers`)}
        />
        <CollapsibleSection
          label="Value Moments"
          items={stage.value_moments_unlocked}
          isOpen={!!openSections[`${stage.level}-moments`]}
          onToggle={() => onToggle(`${stage.level}-moments`)}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Drop-off:</span>
          <Badge
            className={
              RISK_COLORS[stage.drop_off_risk] ?? RISK_COLORS.medium
            }
          >
            {stage.drop_off_risk}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivationMapSection({
  activationMap,
}: {
  activationMap: ActivationMap | null | undefined;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!activationMap) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        No activation map available yet.
      </div>
    );
  }

  const sorted = [...activationMap.stages].sort((a, b) => a.level - b.level);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((stage) => (
        <StageCard
          key={stage.level}
          stage={stage}
          isPrimary={stage.level === activationMap.primary_activation_level}
          openSections={openSections}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
